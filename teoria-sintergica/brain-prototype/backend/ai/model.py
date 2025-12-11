import torch
import torch.nn as nn
import torch.nn.functional as F

class SyntergicVAE(nn.Module):
    """
    Variational Autoencoder que mapea la actividad EEG a un 'Campo Sintérgico' (Espacio Latente).
    
    Teoría:
    - Encoder: Comprime la información neuronal (reducción de entropía).
    - Latent Space (mu, logvar): Representa la estructura fundamental de la Lattice distorsionada.
    - Decoder: Reconstruye la percepción (realidad explicada).
    """
    def __init__(self, input_dim=64, hidden_dim=128, latent_dim=32):
        super(SyntergicVAE, self).__init__()
        
        # Encoder (Colapso de la función de onda)
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU()
        )
        
        # Latent Space vectors
        self.fc_mu = nn.Linear(hidden_dim // 2, latent_dim)
        self.fc_logvar = nn.Linear(hidden_dim // 2, latent_dim)
        
        # Decoder (Expansión hacia la realidad visual)
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, input_dim),
            nn.Sigmoid() # Asumiendo datos normalizados 0-1
        )

    def encode(self, x):
        h = self.encoder(x)
        return self.fc_mu(h), self.fc_logvar(h)

    def reparameterize(self, mu, logvar):
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def decode(self, z):
        return self.decoder(z)

    def forward(self, x):
        mu, logvar = self.encode(x)
        z = self.reparameterize(mu, logvar)
        reconstruction = self.decode(z)
        return reconstruction, mu, logvar

    def get_syntergic_state(self, x):
        """
        Calcula los parámetros sintérgicos basándose en el espacio latente.
        Retorna:
            - Coherencia: Inversa de la varianza promedio (Menor varianza = Mayor certeza/coherencia).
            - Entropía: Magnitud del error de reconstrucción (teórico).
            - Focal Point: Las 3 dimensiones principales del vector latente.
        """
        with torch.no_grad():
            mu, logvar = self.encode(x)
            
            # Coherencia estimada como la "pureza" del estado (baja varianza)
            # Normalizamos para que esté entre 0 y 1
            variance_mean = torch.mean(torch.exp(logvar))
            coherence = 1.0 / (1.0 + variance_mean.item())
            
            # Usamos las primeras 3 dimensiones de 'mu' para mover el foco en 3D
            # Esto mapea el "pensamiento abstracto" a coordenadas espaciales
            # REDUCED SCALE: De 3.0 a 1.5 para asegurar que esté dentro de la malla
            focal_point = {
                "x": mu[0, 0].item() * 1.5,  
                "y": mu[0, 1].item() * 1.5,
                "z": mu[0, 2].item() * 1.5
            }
            
            return coherence, focal_point
