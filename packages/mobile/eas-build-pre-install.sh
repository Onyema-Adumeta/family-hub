#!/bin/bash
echo "=== Working directory ==="
pwd
echo "=== Finding gradle-plugin ==="
find /home/expo/workingdir/build -name "gradle-plugin" -type d 2>/dev/null | head -20
echo "=== node_modules locations ==="
find /home/expo/workingdir/build -name "node_modules" -maxdepth 4 -type d 2>/dev/null