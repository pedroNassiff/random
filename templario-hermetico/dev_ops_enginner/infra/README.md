# Replace <INSTANCE_1_ID> with the ID for tf-instance-1
terraform import module.instances.google_compute_instance.tf-instance-1 3217090065760759851

# Replace <INSTANCE_2_ID> with the ID for tf-instance-2
terraform import module.instances.google_compute_instance.tf-instance-2 6921323496829857835

<!-- student_02_194a008aaf06@cloudshell:~ (qwiklabs-gcp-02-c95755055673)$ gcloud compute instances list --format="table(name, id)"
NAME: tf-instance-1
ID: 3217090065760759851

NAME: tf-instance-2
ID: 6921323496829857835 -->