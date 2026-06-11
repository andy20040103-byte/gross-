import os
import re
import json

image_dir = r"c:\Users\User\Desktop\andy大學\大四下\病理gross期末考"
output_js = os.path.join(image_dir, "db.js")

def clean_display_name(s):
    # Remove file extension
    s = re.sub(r'(?i)\.jpg$', '', s)
    # Remove trailing parentheses with numbers, like (1), (2)
    s = re.sub(r'\(\d+\)$', '', s)
    return s.strip()

def main():
    files = [f for f in os.listdir(image_dir) if f.lower().endswith('.jpg') and os.path.isfile(os.path.join(image_dir, f))]
    print(f"Found {len(files)} files to parse.")
    
    specimens = []
    
    for filename in sorted(files):
        # Determine organ and disease
        base, _ = os.path.splitext(filename)
        
        organ = ""
        disease = ""
        
        if ',' in base:
            parts = base.split(',')
            organ = parts[0].strip()
            # Reconstruct disease from remaining parts
            disease = ', '.join(parts[1:]).strip()
        else:
            base_lower = base.lower().strip()
            if base_lower.startswith("dilated cardiomyopathy"):
                organ = "Heart"
                disease = "dilated cardiomyopathy"
            elif base_lower.startswith("gouty tophi"):
                organ = "Joint/Bone"
                disease = "gouty tophi"
            elif base_lower.startswith("tuberculosis"):
                organ = "Lung"
                disease = "tuberculosis"
            elif base_lower.startswith("testis seminoma"):
                organ = "Testis"
                disease = "seminoma"
            elif base_lower.startswith("mesothelioma"):
                organ = "Pleura/Lung"
                disease = "mesothelioma"
            elif "giant cell tumor of bone" in base_lower:
                organ = "Bone"
                disease = "giant cell tumor"
            else:
                organ = "Other"
                disease = base
                
        # Clean display names
        display_organ = clean_display_name(organ)
        display_disease = clean_display_name(disease)
        
        specimens.append({
            "filename": filename,
            "organ": display_organ,
            "disease": display_disease
        })
        
    # Write to db.js
    with open(output_js, "w", encoding="utf-8") as f:
        f.write("// Automatically generated database of specimens\n")
        f.write("const SPECIMENS = ")
        json.dump(specimens, f, ensure_ascii=False, indent=2)
        f.write(";\n")
        
    print(f"Successfully wrote {len(specimens)} entries to db.js.")

if __name__ == "__main__":
    main()
