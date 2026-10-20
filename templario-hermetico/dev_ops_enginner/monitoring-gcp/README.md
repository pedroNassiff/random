# enable profiler

gcloud services enable cloudprofiler.googleapis.com


# build app
docker build -t test-python .

# run app
docker run --rm -p 8080:8080 test-python


# In a project, an App Engine application has to be created. This is done just once using the gcloud app create command and specifying the region where you want the app to be created. In Cloud Shell, type the following command:

gcloud app create --region=asia-south1

# deploy 
gcloud app deploy --version=one --quiet


# we will generate some traffic to your App Engine app using the web testing tool called Apache Bench. Enter the following commands to install it:

# en la VM 

sudo apt update
sudo apt install apache2-utils -y

#  The command will make a thousand requests, 10 at a time, to your application.


ab -k -n 1000 -c 10 https://<your-project-id>.appspot.com/


# crear cluster GKE

gcloud container clusters create hello-cluster \
  --zone=us-central1-c \
  --release-channel=regular \
  --cluster-version=1.29 \
  --enable-autoscaling \
  --num-nodes=3 \
  --min-nodes=2 \
  --max-nodes=6


  gcloud container clusters get-credentials hello-cluster --zone=us-central1-c

kubectl create namespace prod
kubectl create namespace dev

kubectl get namespaces


# Task 3. Create the Cloud Build Triggers

gcloud builds triggers create manual \
   --name="sample-app-prod-deploy" \
   --inline-config="cloudbuild.yaml" \
   --service-account="projects/${PROJECT_ID}/serviceAccounts/${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
   --region=us-central1

   gcloud builds triggers run sample-app-prod-deploy \
  --region=us-central1 \
  --branch=master

# exponer servicios

  kubectl expose deployment development-deployment \
  --name=dev-deployment-service \
  --type=LoadBalancer \
  --port=8080 \
  --target-port=8080 \
  --namespace=dev


  gcloud builds submit --config=cloudbuild-dev.yaml .
