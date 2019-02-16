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
RUN yarn install --production=false --frozen-lockfile && yarn run build && yarn install --prod --frozen-lockfile

ENV SERVER_PORT 3000
USER nobody
CMD yarn run serve