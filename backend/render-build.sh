#!/usr/bin/env bash
# Exit on error
set -o errexit

echo "Starting custom build..."

# 1. Install Python dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 2. Download missing system libraries for MediaPipe (libGLESv2)
echo "Downloading required system libraries..."
mkdir -p /opt/render/project/src/sys-libs
cd /tmp

# Download the packages without installing them (no root required)
apt-get download libgles2 libglvnd0 || true

# Extract the shared objects (.so files)
if ls *.deb 1> /dev/null 2>&1; then
    for package in *.deb; do 
        dpkg -x "$package" extracted || true
    done
    
    # Copy all extracted .so files to our custom library folder
    find extracted -name "*.so*" -exec cp {} /opt/render/project/src/sys-libs/ \;
    echo "Libraries extracted successfully."
else
    echo "Failed to download libraries. MediaPipe might still crash."
fi

echo "Build complete!"
