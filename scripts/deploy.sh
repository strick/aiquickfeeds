#!/bin/bash
source ~/.nvm/nvm.sh
nvm use 18.17.1

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

LOGFILE="$DIR/../logs/logfile.log"

DEPLOY_PROJECT_LOCATION=$DIR/../static_site_deploy/

exec > >(tee -a "$LOGFILE") 2>&1  # Redirect stdout and stderr to the log file

if [ -t 1 ]; then
    # Output is going to the terminal
    RSS_OUTPUT=$(echo -e "\e[1m\e[33m")
    RSS_OUTPUT_END=$(echo -e "\e[0m")
else
    # Output is being redirected or piped
    RSS_OUTPUT=""
    RSS_OUTPUT_END=""
fi

source $DIR/../.env || { echo $RSS_OUTPUT"Error sourcing .env"$RSS_OUTPUT_END; kill $NODE_PID; exit 1;}

cd $PROJECT_ROOT

fuser -k $DEPLOY_PORT/tcp || true  # Kill any process using the port

# Start the Node.js application in the background
PORT=$DEPLOY_PORT $CMD_NODE $DIR/../index.js &

# Get the process ID of the command we just ran (node index.js)
NODE_PID=$!

while ! nc -z localhost $DEPLOY_PORT; do   
  sleep 0.1  # wait for 100ms before check again
done

echo $RSS_OUTPUT"Begin feed sync"$RSS_OUTPUT_END
wget $DEPLOY_HOST:$DEPLOY_PORT/sync
if [[ $? -ne 0 ]]; then
    echo $RSS_OUTPUT"Error syncing feed."$RSS_OUTPUT_END
    kill $NODE_PID
    exit 1
fi
echo $RSS_OUTPUT"New articles have been sync'd"$RSS_OUTPUT_END

echo $RSS_OUTPUT"Building project"$RSS_OUTPUT_END
wget $DEPLOY_HOST:$DEPLOY_PORT -O $DEPLOY_PROJECT_LOCATION"index.html"
if [[ $? -ne 0 ]]; then
    echo $RSS_OUTPUT"Error building project."$RSS_OUTPUT_END
    kill $NODE_PID
    exit 1
fi

echo $RSS_OUTPUT"Deploying changes to swa"$RSS_OUTPUT_END
echo "Using Node: $(node -v)"
$CMD_SWA deploy $DEPLOY_PROJECT_LOCATION --env $DEPLOY_ENV --app-name $APP_NAME --deployment-token $SWA_CLI_DEPLOYMENT_TOKEN
if [[ $? -ne 0 ]]; then
    echo $RSS_OUTPUT"Error deploying to SWA."$RSS_OUTPUT_END
    rm -rf $DIR/../sync
    kill $NODE_PID
    exit 1
fi

rm -rf $DIR/../sync

echo $RSS_OUTPUT"Success - $(date +'%d/%m/%Y %H:%M:%S')"$RSS_OUTPUT_END
kill $NODE_PID
