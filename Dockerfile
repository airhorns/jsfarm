## Assets builder
FROM node:11
WORKDIR /code

# RUN apt-get -y update && apt-get -y install libseccomp && rm -rf /var/lib/apt/lists/*
COPY --from=disconnect3d/nsjail:latest bin/nsjail bin/nsjail

COPY package.json yarn.lock /code/

# Install runtime dependencies in a first layer
RUN yarn install --prod --frozen-lockfile

# Install build dependencies, build, uninstall build dependencies by rerunning the --prod install
COPY . /code/
RUN yarn install --production=false --frozen-lockfile && yarn run build && yarn install --prod --frozen-lockfile && yarn cache clean
RUN yarn config set global-folder
RUN git rev-parse HEAD > /code/VERSION

USER nobody

# Don't use a package.json script so that signals are forwarded correctly and directly to the node process
CMD ["node", "./build/index.js"]