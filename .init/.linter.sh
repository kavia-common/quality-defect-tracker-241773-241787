#!/bin/bash
cd /home/kavia/workspace/code-generation/quality-defect-tracker-241773-241787/quality_defect_tracking_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

