"""Full model diagnostic on Eyes-Defy-Anemia dataset.

Reads labels from Excel, runs model on every full-eye image, prints confusion matrix.
WHO anemia threshold: Hgb < 12 (female) or < 13 (male).
"""
import json, os
from pathlib import Path

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import numpy as np
from PIL import Image, ExifTags
import tensorflow as tf
import openpyxl

BASE = Path(__file__).resolve().parent
MODEL_PATH = BASE / "model" / "haemia_research_demo.keras"
CONFIG_PATH = BASE / "model" / "haemia_research_demo_config.json"
DATASET = Path(r"D:\dataset anemia")
TARGET = 224

# --- Load model ---
print("Loading model...", flush=True)
model = tf.keras.models.load_model(str(MODEL_PATH), compile=False)
with open(CONFIG_PATH) as f:
    config = json.load(f)
threshold = config["demo_decision_rule"]["threshold"]
print(f"Threshold: {threshold}\n", flush=True)

# --- Read labels ---
def read_labels(xlsx_path):
    """Returns dict: patient_number -> {hgb, gender, anemic}"""
    wb = openpyxl.load_workbook(xlsx_path, read_only=True)
    ws = wb.active
    labels = {}
    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:
            continue  # header
        num, hgb, gender = row[0], row[1], row[2]
        if num is None or hgb is None:
            continue
        num = int(num)
        # Handle both "12.5" and Italian "12,5" decimal formats
        try:
            hgb = float(str(hgb).replace(",", "."))
        except (ValueError, TypeError):
            continue  # skip rows with invalid Hgb
        gender = str(gender).strip().upper()
        # WHO anemia threshold
        anemic = (hgb < 12.0) if gender == "F" else (hgb < 13.0)
        labels[num] = {"hgb": hgb, "gender": gender, "anemic": anemic}
    wb.close()
    return labels

india_labels = read_labels(DATASET / "India" / "India.xlsx")
italy_labels = read_labels(DATASET / "Italy" / "Italy.xlsx")
all_labels = {}
for num, lbl in india_labels.items():
    all_labels[("India", num)] = lbl
for num, lbl in italy_labels.items():
    all_labels[("Italy", num)] = lbl

print(f"Labels loaded: {len(india_labels)} India + {len(italy_labels)} Italy = {len(all_labels)} patients")

# --- Preprocessing ---
def preprocess(path):
    img = Image.open(path)
    try:
        exif = img.getexif()
        ok = next((k for k, v in ExifTags.Base.__members__.items() if v == "Orientation"), None)
        if ok and ok in exif:
            m = {2: Image.Transpose.FLIP_LEFT_RIGHT, 3: Image.Transpose.ROTATE_180,
                 4: Image.Transpose.FLIP_TOP_BOTTOM, 5: Image.Transpose.TRANSPOSE,
                 6: Image.Transpose.ROTATE_270, 7: Image.Transpose.TRANSVERSE,
                 8: Image.Transpose.ROTATE_90}
            if exif[ok] in m:
                img = img.transpose(m[exif[ok]])
    except: pass
    img = img.convert("RGB")
    w, h = img.size
    if min(w, h) < 64:
        return None
    s = min(w, h)
    l, t = (w - s) // 2, (h - s) // 2
    img = img.crop((l, t, l + s, t + s))
    img = img.resize((TARGET, TARGET), Image.LANCZOS)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    return np.expand_dims(arr, 0)

# --- Find all images ---
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
results = []
total = 0
for country in ["India", "Italy"]:
    country_dir = DATASET / country
    for patient_dir in sorted(country_dir.iterdir()):
        if not patient_dir.is_dir():
            continue
        try:
            pnum = int(patient_dir.name)
        except ValueError:
            continue
        key = (country, pnum)
        if key not in all_labels:
            continue
        lbl = all_labels[key]
        imgs = [f for f in patient_dir.iterdir() if f.suffix.lower() in IMAGE_EXTS]
        for img_path in imgs:
            total += 1
            try:
                batch = preprocess(img_path)
                if batch is None:
                    continue
                raw = float(model.predict(batch, verbose=0)[0][0])
                predicted_anemic = raw >= threshold
                results.append({
                    "country": country,
                    "patient": pnum,
                    "file": img_path.name,
                    "hgb": lbl["hgb"],
                    "gender": lbl["gender"],
                    "true_anemic": lbl["anemic"],
                    "score": raw,
                    "pred_anemic": predicted_anemic,
                })
            except Exception as e:
                pass
            if total % 50 == 0:
                print(f"  Processed {total} images...", flush=True)

print(f"\nProcessed {len(results)} images total.\n")

# --- Results ---
# Confusion matrix
tp = sum(1 for r in results if r["true_anemic"] and r["pred_anemic"])
fp = sum(1 for r in results if not r["true_anemic"] and r["pred_anemic"])
tn = sum(1 for r in results if not r["true_anemic"] and not r["pred_anemic"])
fn = sum(1 for r in results if r["true_anemic"] and not r["pred_anemic"])

print("=" * 60)
print(f"  CONFUSION MATRIX  (threshold = {threshold})")
print("=" * 60)
print(f"                        Predicted")
print(f"                  Anemic    Not-Anemic")
print(f"  True Anemic     {tp:>5}       {fn:>5}")
print(f"  True Healthy    {fp:>5}       {tn:>5}")
print()

total_pred = tp + fp + tn + fn
if total_pred > 0:
    accuracy = (tp + tn) / total_pred
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    print(f"  Accuracy:    {accuracy:.3f}  ({tp+tn}/{total_pred})")
    print(f"  Sensitivity: {sensitivity:.3f}  (TPR - catches anemic)")
    print(f"  Specificity: {specificity:.3f}  (TNR - catches healthy)")

# --- Score distribution ---
anemic_scores = [r["score"] for r in results if r["true_anemic"]]
healthy_scores = [r["score"] for r in results if not r["true_anemic"]]

print(f"\n--- Score Distribution ---")
if anemic_scores:
    print(f"  Anemic patients ({len(anemic_scores)} images):")
    print(f"    Mean: {np.mean(anemic_scores):.4f}  Median: {np.median(anemic_scores):.4f}")
    print(f"    Min:  {min(anemic_scores):.4f}  Max: {max(anemic_scores):.4f}")
if healthy_scores:
    print(f"  Healthy patients ({len(healthy_scores)} images):")
    print(f"    Mean: {np.mean(healthy_scores):.4f}  Median: {np.median(healthy_scores):.4f}")
    print(f"    Min:  {min(healthy_scores):.4f}  Max: {max(healthy_scores):.4f}")

# --- Find best threshold ---
if anemic_scores and healthy_scores:
    print(f"\n--- Optimal Threshold Search ---")
    best_thresh, best_acc = 0.5, 0
    for t in np.arange(0.1, 0.9, 0.01):
        tp_t = sum(1 for s in anemic_scores if s >= t)
        tn_t = sum(1 for s in healthy_scores if s < t)
        acc_t = (tp_t + tn_t) / len(results)
        if acc_t > best_acc:
            best_acc = acc_t
            best_thresh = t
    print(f"  Best threshold: {best_thresh:.2f}  (accuracy: {best_acc:.3f})")
    
    # Show what confusion matrix would look like at best threshold
    tp2 = sum(1 for r in results if r["true_anemic"] and r["score"] >= best_thresh)
    fp2 = sum(1 for r in results if not r["true_anemic"] and r["score"] >= best_thresh)
    tn2 = sum(1 for r in results if not r["true_anemic"] and r["score"] < best_thresh)
    fn2 = sum(1 for r in results if r["true_anemic"] and r["score"] < best_thresh)
    sens2 = tp2 / (tp2 + fn2) if (tp2 + fn2) > 0 else 0
    spec2 = tn2 / (tn2 + fp2) if (tn2 + fp2) > 0 else 0
    print(f"\n  At threshold {best_thresh:.2f}:")
    print(f"    Accuracy:    {best_acc:.3f}")
    print(f"    Sensitivity: {sens2:.3f}")
    print(f"    Specificity: {spec2:.3f}")
    print(f"    TP={tp2} FP={fp2} TN={tn2} FN={fn2}")
