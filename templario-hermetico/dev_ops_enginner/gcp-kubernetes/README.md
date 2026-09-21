# crear artifact repositorty

gcloud artifacts repositories create devops-demo \
    --repository-format=docker \
    --location=us-east4


gcloud auth configure-docker us-east4-docker.pkg.dev

gcloud builds submit --tag us-east4-docker.pkg.dev/$DEVSHELL_PROJECT_ID/devops-demo/devops-image:v0.2 .


When the previous command completes, the image name will be listed in the output. The image name is in the form us-east4-docker.pkg.dev/PROJECT_ID/devops-demo/devops-image:v0.2.

Highlight your image name and copy it to the clipboard. Paste that value in the kubernetes-config.yaml file, overwriting the string <YOUR IMAGE PATH HERE>.

spec:
  containers:
  - name: devops-demo
    image: us-east4-docker.pkg.dev/PROJECT_ID/devops-demo/devops-image:v0.2
    ports:


kubectl apply -f kubernetes-config.yaml

kubectl get pods

kubectl get services
