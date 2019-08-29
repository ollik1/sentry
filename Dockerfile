FROM 652884599935.dkr.ecr.us-east-1.amazonaws.com/nosto/base:debian

ENV NVM_DIR /root/.nvm
ENV NODE_VERSION 8.15.1

RUN apt-get update && \
    apt-get install -y python-pip python-setuptools curl make git && \
    pip install virtualenv wheel

RUN mkdir -p /opt/sentry
WORKDIR /opt/sentry
COPY . .

RUN virtualenv .venv && . .venv/bin/activate

# builds sentry under /opt/sentry/dist/sentry-x.x.x.tar.gz
RUN mkdir -p $NVM_DIR && \
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.34.0/install.sh | bash && \
    . $NVM_DIR/nvm.sh && \
    nvm install && \
    npm install --production && \
    python setup.py sdist bdist_wheel
