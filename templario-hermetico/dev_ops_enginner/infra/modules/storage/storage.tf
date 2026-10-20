resource "google_storage_bucket" "remote-backend" {
  name          = "tf-bucket-640722"
  location      = "US"
  force_destroy = true
  uniform_bucket_level_access = true
  
}