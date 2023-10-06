#!/bin/bash

# Start the Node.js application in the background
node index.js &
# Get the process ID of the command we just ran (node index.js)
NODE_PID=$!

source .env || { echo "Error sourcing .env"; kill $NODE_PID; exit 1;}

echo "Begin feed sync"
wget $DEPLOY_HOST/sync
if [[ $? -ne 0 ]]; then
    echo "Error syncing feed."
    kill $NODE_PID
    exit 1
fi
echo "New articles have been sync'd"

echo "Building project"
wget $DEPLOY_HOST -O $DEPLOY_PROJECT_LOCATION"index.html"
if [[ $? -ne 0 ]]; then
    echo "Error building project."
    kill $NODE_PID
    exit 1
fi

echo "Deploying changes to swa"
swa deploy $DEPLOY_PROJECT_LOCATION --env $DEPLOY_ENV --app-name $APP_NAME --deployment-token $SWA_CLI_DEPLOYMENT_TOKEN
if [[ $? -ne 0 ]]; then
    echo "Error deploying to SWA."
    kill $NODE_PID
    exit 1
fi

echo "Success"
kill $NODE_PID
