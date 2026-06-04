#!/bin/bash
# Install from monorepo root so node can resolve react-native
cd ../..
npm install --legacy-peer-deps
cd packages/mobile
