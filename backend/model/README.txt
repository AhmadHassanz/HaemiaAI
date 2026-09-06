HAEMIA RESEARCH DEMO

Status: Research prototype only; not clinically validated.
This model does not diagnose anemia and must not be used for medical decisions.

Model input: Full-eye RGB image, center-cropped and resized to 224x224.
Output: Uncalibrated raw model score. Do not describe it as anemia probability.

Development evidence:
- 216 full-eye images from Eyes-Defy-Anemia
- 3x3 grouped nested-CV AUC: 0.747
- Sensitivity: 0.656; specificity: 0.675
- No patient IDs and no external test cohort
