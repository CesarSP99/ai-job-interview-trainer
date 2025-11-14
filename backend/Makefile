# FastAPI + Docker automation for Interview Trainer API

SERVICE_NAME=interview-trainer-api
IMAGE_NAME=$(SERVICE_NAME):latest
REGISTRY=cloud.cesarsp.com
REGISTRY_IMAGE=$(REGISTRY)/$(SERVICE_NAME):latest
PORT ?= 8000
CONTAINER_NAME=$(SERVICE_NAME)

# Build Docker image (alias for docker-build to keep muscle memory)
build: docker-build

# Build Docker image
docker-build:
	docker build -t $(IMAGE_NAME) .

# Run the Docker container locally
run:
	docker run -d --name $(CONTAINER_NAME) -p $(PORT):8000 $(IMAGE_NAME)

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

# Push the image to private registry
push:
	docker tag $(IMAGE_NAME) $(REGISTRY_IMAGE)
	docker push $(REGISTRY_IMAGE)

# Convenience: rebuild and push in a single command
deploy: rebuild push
