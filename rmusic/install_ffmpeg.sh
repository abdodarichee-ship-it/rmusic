#!/bin/bash

# Install FFmpeg on Ubuntu/Debian
echo "Installing FFmpeg..."
sudo apt update
sudo apt install -y ffmpeg

# Verify installation
ffmpeg -version

if [ $? -eq 0 ]; then
    echo " FFmpeg installed successfully!"
else
    echo " FFmpeg installation failed"
    exit 1
fi