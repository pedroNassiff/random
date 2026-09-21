resource "google_compute_instance" "my_instance" {
    // los mandatorys
    network_interface {
      network = google_compute_network.my_network.name
      access_config {
        
      }
    }
}

resource "google_compute_network" "my_network" {
    name = "my_network"
}

# depends_on sirve para crear algo cuando otro recurso se ha creado
resource "google_compute_firewall" "my_firewall" {
    name    = "my_firewall"
    network = google_compute_network.my_network.name

    allow {
        protocol = "tcp"
        ports    = ["22", "80", "443"]
    }

    depends_on = [google_compute_network.my_network]
}