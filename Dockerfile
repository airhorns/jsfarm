## Assets builder
FROM node:11
WORKDIR /code

# RUN apt-get -y update && apt-get -y install libseccomp && rm -rf /var/lib/apt/lists/*
COPY --from=disconnect3d/nsjail:latest bin/nsjail bin/nsjail

# Install dependencies in a first layer
COPY package.json yarn.lock /code/
RUN yarn install --frozen-lockfile && yarn cache clean

COPY . /code/
RUN yarn run build

RUN git rev-parse HEAD > /code/VERSION
USER nobody

# Don't use a package.json script so that signals are forwarded correctly and directly to the node process
CMD ["node", "./build/index.js"]