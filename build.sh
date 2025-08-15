#!/bin/bash

# Build the application
npm run build

# Copy static files to the correct location for production
mkdir -p server/public
cp -r dist/public/* server/public/

echo "Build completed successfully!"