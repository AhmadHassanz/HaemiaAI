"""Regression checks for phone-image uploads: python -m unittest test_upload."""
import io
import unittest
from unittest.mock import patch

import main
from PIL import Image


def photo(size, format='PNG', exif=None):
    output = io.BytesIO()
    with Image.new('RGB', size, (100, 130, 160)) as image:
        image.save(output, format=format, **({'exif': exif} if exif else {}))
    return output.getvalue()


class UploadTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not main._model_ready_event.wait(120):
            raise RuntimeError('Model startup did not finish')

    def test_phone_jpeg_is_reduced_before_decode(self):
        processed, error = main._preprocess_full(photo((8000, 6000), 'JPEG'))
        self.assertIsNone(error)
        if main._HAS_TF:
            self.assertEqual(processed.shape, (1, 224, 224, 3))

    def test_large_png_is_rejected_before_pixel_decode(self):
        data = photo((3000, 2000))
        with patch.object(Image.Image, 'load', side_effect=AssertionError('Decoded oversized image')):
            processed, error = main._preprocess_full(data)
        self.assertIsNone(processed)
        self.assertIn('resolution', error)

    def test_normal_photo_and_inference(self):
        processed, error = main._preprocess_full(photo((1600, 1200)))
        self.assertIsNone(error)
        self.assertTrue(main._HAS_TF, f'Real model unavailable: {main._model_error}')
        score = float(main.model(processed, training=False)[0][0])
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 1)

    def test_small_and_invalid_images(self):
        self.assertIn('small', main._preprocess_full(photo((32, 32)))[1])
        self.assertIsNotNone(main._preprocess_full(b'not an image')[1])


if __name__ == '__main__':
    unittest.main()
