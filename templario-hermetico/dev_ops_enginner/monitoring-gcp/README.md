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
