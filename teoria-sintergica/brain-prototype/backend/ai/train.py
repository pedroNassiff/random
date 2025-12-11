import torch
import torch.optim as optim
from torch.utils.data import DataLoader
from dataset import EEGDataset
from model import SyntergicVAE
import os

def train():
    # 1. Configuración
    BATCH_SIZE = 32
    EPOCHS = 10
    LEARNING_RATE = 1e-3
    MODEL_PATH = "syntergic_vae.pth"
    
    device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Using device: {device}")

    # 2. Cargar Datos
    print("Initializing dataset (this might download data from PhysioNet)...")
    dataset = EEGDataset(subjects=[1, 2], runs=[6, 10, 14]) # Usamos 2 sujetos para empezar
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    
    input_dim = dataset.get_input_dim()
    
    # 3. Inicializar Modelo
    model = SyntergicVAE(input_dim=input_dim, hidden_dim=512, latent_dim=64).to(device)
    optimizer = optim.Adam(model.parameters(), lr=LEARNING_RATE)
    
    # Función de pérdida para VAE (Reconstruction + KL Divergence)
    def loss_function(recon_x, x, mu, logvar):
        BCE = torch.nn.functional.mse_loss(recon_x, x, reduction='sum')
        # KL divergence
        KLD = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
        return BCE + KLD

    # 4. Bucle de Entrenamiento
    model.train()
    for epoch in range(EPOCHS):
        train_loss = 0
        for batch_idx, data in enumerate(dataloader):
            data = data.to(device)
            
            optimizer.zero_grad()
            
            recon_batch, mu, logvar = model(data)
            loss = loss_function(recon_batch, data, mu, logvar)
            
            loss.backward()
            train_loss += loss.item()
            optimizer.step()
            
        print(f'Epoch: {epoch+1} | Average Loss: {train_loss / len(dataloader.dataset):.4f}')

    # 5. Guardar Modelo
    torch.save(model.state_dict(), MODEL_PATH)
    print(f"Model saved to {MODEL_PATH}")

if __name__ == "__main__":
    train()
