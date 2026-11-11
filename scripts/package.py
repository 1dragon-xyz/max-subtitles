#!/usr/bin/env python3
"""
Packaging script for Max Subtitles Chrome Extension.
Creates a clean, production-ready .zip archive in dist/ for Chrome Web Store upload.
"""

import os
import sys
import json
import zipfile

def build_package():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    manifest_path = os.path.join(root_dir, 'manifest.json')

    if not os.path.exists(manifest_path):
        print("Error: manifest.json not found in project root!", file=sys.stderr)
        sys.exit(1)

    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)

    version = manifest.get('version', '1.0.0')
    dist_dir = os.path.join(root_dir, 'dist')
    os.makedirs(dist_dir, exist_ok=True)

    zip_filename = f"max-subtitles-v{version}.zip"
    zip_path = os.path.join(dist_dir, zip_filename)

    # Clean previous build
    if os.path.exists(zip_path):
        os.remove(zip_path)

    # Required files and directories to include in extension package
    includes = ['manifest.json', 'icons', 'src', 'LICENSE', 'PRIVACY.md']
    excluded_extensions = ['.DS_Store', '.git', '.tmp', '.log']

    total_files = 0
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for item in includes:
            full_path = os.path.join(root_dir, item)
            if os.path.isfile(full_path):
                zip_file.write(full_path, arcname=item)
                total_files += 1
            elif os.path.isdir(full_path):
                for root, dirs, files in os.walk(full_path):
                    for file in files:
                        if any(file.endswith(ext) for ext in excluded_extensions):
                            continue
                        file_path = os.path.join(root, file)
                        arcname = os.path.relpath(file_path, root_dir)
                        zip_file.write(file_path, arcname=arcname)
                        total_files += 1

    file_size_kb = os.path.getsize(zip_path) / 1024
    print("==================================================")
    print(" Max Subtitles Chrome Web Store Packaging Complete ")
    print("==================================================")
    print(f"Archive:    {zip_path}")
    print(f"Version:    {version}")
    print(f"Files:      {total_files}")
    print(f"Size:       {file_size_kb:.1f} KB")
    print("Ready for upload to Chrome Web Store Developer Dashboard!")

if __name__ == '__main__':
    build_package()
