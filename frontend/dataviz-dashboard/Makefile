# React + Nginx Docker automation for Interview Trainer Frontend

SERVICE_NAME=interview-trainer-frontend

# Docker Hub username (change if needed)
DOCKER_USER=mmoran002

# Local image name (full, including user, so it pushes cleanly)
IMAGE_NAME=$(DOCKER_USER)/$(SERVICE_NAME):latest

# Port exposed on your local machine when running the container
# Container listens on 80 (nginx), we map HOST_PORT:80
PORT ?= 3000

CONTAINER_NAME=$(SERVICE_NAME)

# Build Docker image (alias for docker-build to keep muscle memory)
build: docker-build

# Build Docker image
docker-build:
	docker build -t $(IMAGE_NAME) .

# Run the Docker container locally (for quick testing)
run:
	docker run -d --name $(CONTAINER_NAME) -p $(PORT):80 $(IMAGE_NAME)

# Stop and remove the running container (if any)
stop:
	- docker stop $(CONTAINER_NAME)
	- docker rm $(CONTAINER_NAME)

# View logs from the running container
logs:
	docker logs -f $(CONTAINER_NAME)

# Rebuild image without cache (useful after big changes)
rebuild: stop
	docker build --no-cache -t $(IMAGE_NAME) .

# Push the image to Docker Hub
push:
	docker push $(IMAGE_NAME)

# Convenience: rebuild and push in a single command
deploy: rebuild push

