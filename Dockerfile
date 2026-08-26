# ==========================================
# GLOBAL BUILD ARGUMENTS
# ==========================================
ARG JFROG_USERNAME
ARG JFROG_ACCESS_TOKEN
ARG LABEL_MAINTAINER="ceso-isg-platengr@globe.com.ph"
ARG LABEL_VERSION="v3.0.0"
ARG JFROG_URL="globe.pe.jfrog.io"
ARG JFROG_REPO="hmd-docker-virtual"
ARG BASE_IMAGE="node:22.14.0-alpine"
ARG NGINX_IMAGE="nginxinc/nginx-unprivileged:bookworm-perl"

# ==========================================
# STAGE 1: COMPILATION ENVIRONMENT (React Build)
# ==========================================
FROM ${JFROG_URL}/${JFROG_REPO}/${BASE_IMAGE} AS builder

# Inherit Global Build Args
ARG JFROG_USERNAME
ARG JFROG_ACCESS_TOKEN
ARG LABEL_MAINTAINER
ARG LABEL_VERSION
ARG JFROG_URL
ARG JFROG_REPO

LABEL maintainer=$LABEL_MAINTAINER
LABEL version=$LABEL_VERSION

USER root

# Clean and point Alpine mirrors to v3.21 (Matches Node 22 Alpine)
RUN cp /dev/null /etc/apk/repositories && \
    echo "https://${JFROG_USERNAME}:${JFROG_ACCESS_TOKEN}@${JFROG_URL}/artifactory/hmd-alpinelinux/v3.21/main" >> /etc/apk/repositories && \
    echo "https://${JFROG_USERNAME}:${JFROG_ACCESS_TOKEN}@${JFROG_URL}/artifactory/hmd-alpinelinux/v3.21/community" >> /etc/apk/repositories

# Install build dependencies
RUN apk update && apk add --no-cache curl bash

WORKDIR /app

# Change ownership to the non-privileged node user
RUN chown -R node:node /app

USER node

# Copy package manifests
COPY --chown=node:node package*.json ./

# Dependency Installation
# Authenticate using the 'node' user's home directory (~)
RUN echo "registry=https://${JFROG_URL}/artifactory/api/npm/hmd-npm-virtual" > ~/.npmrc && \
    curl -u ${JFROG_USERNAME}:${JFROG_ACCESS_TOKEN} https://${JFROG_URL}/artifactory/api/npm/auth/ | \
    sed "s,_auth = ,//${JFROG_URL}/artifactory/api/npm/hmd-npm-virtual/:_auth=\",g" | \
    sed '1 s/$/"/' >> ~/.npmrc

# Clean install all dependencies (including devDependencies needed for compiling React)
RUN npm ci --loglevel verbose

# Copy source code
COPY --chown=node:node . .

# Run React compilation
RUN NODE_OPTIONS="--max_old_space_size=1024" npm run build

# Strip credentials out before finalizing this stage
RUN rm -f ~/.npmrc

# ==========================================
# STAGE 2: PRODUCTION RUNTIME (Nginx Web Server)
# ==========================================
FROM ${JFROG_URL}/${JFROG_REPO}/${NGINX_IMAGE} AS production

USER root

# Expose web server ports
EXPOSE 8080 443

# Ensure logs flow seamlessly to stdout/stderr for container monitoring
RUN ln -sf /dev/stdout /var/log/nginx/access.log \
    && ln -sf /dev/stderr /var/log/nginx/error.log

# Copy Compiled Static React Web Assets from Stage 1
COPY --from=builder /app/dist /usr/share/nginx/esatp-portal

# Set open file and directory ownership for the unprivileged runtime engine
RUN chown -R nginx:nginx /usr/share/nginx/html

# Re-engage the secure, unprivileged runtime user
USER nginx

# FORCED FIX: Tell Nginx to write its PID file to the globally writable /tmp directory
CMD ["nginx", "-g", "daemon off; pid /tmp/nginx.pid;"]
