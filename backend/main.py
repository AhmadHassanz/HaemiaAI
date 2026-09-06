"""
Haemia Research Demo – Zero-dependency backend.

Uses ONLY Python standard library so it works on any Python version,
including 3.14 where no scientific wheels exist yet.

Endpoints:
  POST /api/v1/predict  – accept a full-eye image, return prototype signal
  GET  /health          – liveness / model status

Image decoding uses pure-Python fallback when Pillow is unavailable
(accepts JPEG/PNG/WEBP headers and basic size validation).

When TensorFlow + numpy + Pillow are installed (Python 3.10-3.12), full
preprocessing and model inference are enabled automatically.
"""

import io
import json
import logging
import os
import struct
from email.parser import BytesHeaderParser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("haemia")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "model"
MODEL_PATH = MODEL_DIR / "haemia_research_demo.keras"
CONFIG_PATH = MODEL_DIR / "haemia_research_demo_config.json"

# Load .env manually (no python-dotenv dependency)
ENV_PATH = BASE_DIR / ".env"
if ENV_PATH.exists():
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

PORT = int(os.getenv("PORT", "8000"))
MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
TARGET_SIZE = 224
DARK_THRESHOLD = 5.0
BRIGHT_THRESHOLD = 250.0
MIN_SHORT_EDGE = 64

DISCLAIMER = (
    "Research prototype only. This image-based estimate is not clinically "
    "validated and must not be used for medical decisions. If you are "
    "concerned about anemia, consult a healthcare professional and consider "
    "blood testing."
)

# ---------------------------------------------------------------------------
# Load config
# ---------------------------------------------------------------------------
with open(CONFIG_PATH, "r", encoding="utf-8") as _f:
    config: dict = json.load(_f)

MODEL_STATUS: str = config.get(
    "model_status", "research_prototype_not_clinically_validated"
)
DEMO_THRESHOLD: float = config["demo_decision_rule"]["threshold"]

# ---------------------------------------------------------------------------
# Conditional heavy imports
# ---------------------------------------------------------------------------
_HAS_TF = False
_HAS_NP = False
_HAS_PIL = False

try:
    import numpy as np  # type: ignore[import-untyped]
    _HAS_NP = True
except ImportError:
    np = None  # type: ignore[assignment]

try:
    from PIL import Image, ExifTags, UnidentifiedImageError  # type: ignore[import-untyped]
    _HAS_PIL = True
except ImportError:
    Image = None  # type: ignore[assignment,misc]
    ExifTags = None  # type: ignore[assignment,misc]
    UnidentifiedImageError = Exception  # type: ignore[assignment,misc]

model = None

if _HAS_NP and _HAS_PIL:
    try:
        os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
        import tensorflow as tf  # type: ignore[import-untyped]

        model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
        _ = model.predict(
            np.zeros((1, TARGET_SIZE, TARGET_SIZE, 3), dtype=np.float32),
            verbose=0,
        )
        _HAS_TF = True
        logger.info("TensorFlow model loaded – full inference enabled.")
    except ImportError:
        logger.warning("TensorFlow not found – mock inference mode.")
    except Exception as exc:
        logger.warning("Model load failed (%s) – mock inference mode.", exc)
else:
    missing = []
    if not _HAS_NP:
        missing.append("numpy")
    if not _HAS_PIL:
        missing.append("Pillow")
    logger.warning(
        "Missing: %s – mock inference mode. "
        "Install Python 3.10-3.12 + requirements.txt for real inference.",
        ", ".join(missing),
    )

RUNTIME_STATUS = MODEL_STATUS if _HAS_TF else "mock_mode_model_not_loaded"

# ---------------------------------------------------------------------------
# Image helpers
# ---------------------------------------------------------------------------

def _detect_image_type(data: bytes) -> str | None:
    """Detect image type from magic bytes."""
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _get_png_dimensions(data: bytes) -> tuple[int, int]:
    """Extract width, height from a PNG IHDR chunk."""
    if len(data) < 24:
        raise ValueError("PNG too small")
    w = struct.unpack(">I", data[16:20])[0]
    h = struct.unpack(">I", data[20:24])[0]
    return w, h


def _get_jpeg_dimensions(data: bytes) -> tuple[int, int]:
    """Extract width, height from a JPEG by scanning for SOF marker."""
    i = 2
    while i < len(data) - 1:
        if data[i] != 0xFF:
            break
        marker = data[i + 1]
        if marker in (0xC0, 0xC1, 0xC2):
            if i + 9 < len(data):
                h = struct.unpack(">H", data[i + 5 : i + 7])[0]
                w = struct.unpack(">H", data[i + 7 : i + 9])[0]
                return w, h
            break
        if i + 3 < len(data):
            length = struct.unpack(">H", data[i + 2 : i + 4])[0]
            i += 2 + length
        else:
            break
    raise ValueError("Cannot determine JPEG dimensions")


def _validate_image_basic(data: bytes) -> tuple[str, int, int]:
    """Validate image type and return (type, width, height). Raises ValueError."""
    img_type = _detect_image_type(data)
    if img_type is None:
        raise ValueError("Not a valid JPEG, PNG, or WEBP image.")

    if img_type == "png":
        w, h = _get_png_dimensions(data)
    elif img_type == "jpeg":
        w, h = _get_jpeg_dimensions(data)
    else:
        # WEBP: extract from VP8 header
        if len(data) < 30:
            raise ValueError("WEBP file too small")
        # Simple: use 0x0 and let full preprocessing handle it
        w, h = 224, 224  # placeholder for basic validation
    return img_type, w, h


def _preprocess_full(data: bytes):
    """Full preprocessing with Pillow+numpy. Returns np array or dict."""
    try:
        img = Image.open(io.BytesIO(data))
    except UnidentifiedImageError:
        return None, "The uploaded file is not a valid JPEG, PNG, or WEBP image."
    except Exception:
        return None, "Unable to read the uploaded file."

    # EXIF transpose
    try:
        exif = img.getexif()
        orientation_key = next(
            (k for k, v in ExifTags.Base.__members__.items() if v == "Orientation"),
            None,
        )
        if orientation_key and orientation_key in exif:
            orientation_val = exif[orientation_key]
            transpose_map = {
                2: Image.Transpose.FLIP_LEFT_RIGHT,
                3: Image.Transpose.ROTATE_180,
                4: Image.Transpose.FLIP_TOP_BOTTOM,
                5: Image.Transpose.TRANSPOSE,
                6: Image.Transpose.ROTATE_270,
                7: Image.Transpose.TRANSVERSE,
                8: Image.Transpose.ROTATE_90,
            }
            if orientation_val in transpose_map:
                img = img.transpose(transpose_map[orientation_val])
    except Exception:
        pass

    img = img.convert("RGB")

    w, h = img.size
    if min(w, h) < MIN_SHORT_EDGE:
        return None, f"Image is too small ({w}x{h}). Please upload a larger, clearer photo."

    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    img = img.crop((left, top, left + side, top + side))
    img = img.resize((TARGET_SIZE, TARGET_SIZE), Image.LANCZOS)

    arr = np.asarray(img, dtype=np.float32) / 255.0
    mean_255 = arr.mean() * 255.0

    if mean_255 < DARK_THRESHOLD:
        return None, "The image appears to be extremely dark. Please retake it in better lighting."
    if mean_255 > BRIGHT_THRESHOLD:
        return None, "The image appears to be overexposed. Please retake it with less glare."

    if _HAS_TF:
        return np.expand_dims(arr, axis=0), None
    return {"mean_brightness_255": mean_255}, None


def _preprocess_basic(data: bytes) -> tuple[dict | None, str | None]:
    """Basic validation without Pillow. Returns mock info or error."""
    try:
        img_type, w, h = _validate_image_basic(data)
    except ValueError as e:
        return None, str(e)

    if min(w, h) < MIN_SHORT_EDGE:
        return None, f"Image is too small ({w}x{h}). Please upload a larger, clearer photo."

    # Estimate brightness from raw bytes (rough heuristic)
    byte_mean = sum(data[:10000]) / min(len(data), 10000)
    return {"mean_brightness_255": byte_mean, "img_type": img_type}, None


def _mock_score(info: dict) -> float:
    """Deterministic mock score for testing the UI flow."""
    brightness = info.get("mean_brightness_255", 128)
    score = 0.3 + 0.4 * ((brightness - 5.0) / 245.0)
    return max(0.0, min(1.0, score))


# ---------------------------------------------------------------------------
# HTTP Handler
# ---------------------------------------------------------------------------
class Handler(BaseHTTPRequestHandler):
    def _cors_headers(self):
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS or not ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin or "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json_response(self, code: int, body: dict):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self._cors_headers()
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors_headers()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            self._json_response(200, {
                "status": "ok",
                "model_status": RUNTIME_STATUS,
                "inference_mode": "tensorflow" if _HAS_TF else "mock",
            })
        else:
            self._json_response(404, {"detail": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/v1/predict":
            self._json_response(404, {"detail": "Not found"})
            return

        content_type = self.headers.get("Content-Type", "")
        content_length = int(self.headers.get("Content-Length", "0"))

        if content_length > MAX_FILE_BYTES:
            self._json_response(413, {"detail": "File exceeds the 10 MB size limit."})
            return

        # Parse multipart
        if "multipart/form-data" not in content_type:
            self._json_response(400, {"detail": "Expected multipart/form-data with an 'image' field."})
            return

        # Read body
        body_bytes = self.rfile.read(content_length)

        # Parse multipart manually (cgi module removed in 3.13)
        try:
            boundary = None
            for part in content_type.split(";"):
                part = part.strip()
                if part.startswith("boundary="):
                    boundary = part[len("boundary="):].strip('"')
                    break
            if not boundary:
                self._json_response(400, {"detail": "Missing multipart boundary."})
                return

            image_data, file_ct = self._extract_multipart_field(
                body_bytes, boundary.encode(), "image"
            )
        except Exception:
            self._json_response(400, {"detail": "Failed to parse multipart body."})
            return

        if image_data is None:
            self._json_response(400, {"detail": "Missing 'image' field in form data."})
            return

        if file_ct not in ALLOWED_CONTENT_TYPES:
            # Also check by extension
            fname = getattr(image_field, "filename", "") or ""
            ext = Path(fname).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS and file_ct not in ALLOWED_CONTENT_TYPES:
                self._json_response(400, {"detail": "Only JPEG, PNG, and WEBP images are accepted."})
                return

        if len(image_data) == 0:
            self._json_response(400, {"detail": "The uploaded file is empty."})
            return
        if len(image_data) > MAX_FILE_BYTES:
            self._json_response(413, {"detail": "File exceeds the 10 MB size limit."})
            return

        # Preprocess
        if _HAS_PIL and _HAS_NP:
            processed, error = _preprocess_full(image_data)
        else:
            processed, error = _preprocess_basic(image_data)

        if error:
            self._json_response(400, {"detail": error})
            return

        # Inference
        if _HAS_TF:
            raw_score = float(model.predict(processed, verbose=0)[0][0])
        else:
            raw_score = _mock_score(processed)

        risk = "higher" if raw_score >= DEMO_THRESHOLD else "lower"
        message = (
            "Higher prototype signal detected. This is not a diagnosis."
            if risk == "higher"
            else "Lower prototype signal detected. This is not a diagnosis."
        )

        self._json_response(200, {
            "risk": risk,
            "prototype_score": round(raw_score, 4),
            "score_type": "uncalibrated_model_score",
            "model_status": RUNTIME_STATUS,
            "message": message,
            "disclaimer": DISCLAIMER,
        })

    def log_message(self, format, *args):
        logger.info(format, *args)

    @staticmethod
    def _extract_multipart_field(
        body: bytes, boundary: bytes, field_name: str
    ) -> tuple[bytes | None, str]:
        """Extract a named field from a multipart/form-data body.

        Returns (file_bytes, content_type) or (None, '') if not found.
        """
        sep = b"--" + boundary
        parts = body.split(sep)
        parser = BytesHeaderParser()
        for part in parts:
            if not part or part.strip() in (b"", b"--", b"--\r\n"):
                continue
            # Split headers from body at first blank line
            if b"\r\n\r\n" in part:
                header_block, file_body = part.split(b"\r\n\r\n", 1)
            elif b"\n\n" in part:
                header_block, file_body = part.split(b"\n\n", 1)
            else:
                continue
            # Remove trailing boundary markers
            if file_body.endswith(b"\r\n"):
                file_body = file_body[:-2]
            # Parse headers (strip leading whitespace from boundary split)
            headers = parser.parsebytes(header_block.strip() + b"\n")
            disposition = headers.get("Content-Disposition", "")
            if f'name="{field_name}"' not in disposition:
                continue
            ct = headers.get("Content-Type", "application/octet-stream")
            return file_body, ct.strip()
        return None, ""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    logger.info("Haemia backend listening on http://0.0.0.0:%d", PORT)
    logger.info("Inference mode: %s", "tensorflow" if _HAS_TF else "mock")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    server.server_close()
