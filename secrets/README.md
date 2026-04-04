# Secrets

Encrypted with [sops](https://github.com/getsops/sops) + [age](https://github.com/FiloSottile/age).

## Setup

1. Generate an age keypair for the operator:
   ```
   age-keygen -o operator.key
   ```
   Put the public key in `.sops.yaml` under `&operator`.

2. Get the deploy target's age public key from its SSH host key:
   ```
   ssh-to-age -i /etc/ssh/ssh_host_ed25519_key.pub
   ```
   Put that in `.sops.yaml` under `&deploy`.

3. After running `tofu apply`, encrypt the tunnel token:
   ```
   cd terraform
   tofu output -raw tunnel_token > /tmp/token
   cd ..
   sops secrets/tunnel.yaml   # creates file, add: tunnel_token: <paste token>
   rm /tmp/token
   ```

   Or in one shot:
   ```
   sops set secrets/tunnel.yaml '["tunnel_token"]' "\"$(cd terraform && tofu output -raw tunnel_token)\""
   ```

4. On the deploy target, ensure the age private key is available at:
   ```
   /etc/age/keys.txt          # or set SOPS_AGE_KEY_FILE
   ```
   Derived from the SSH host key:
   ```
   ssh-to-age -private-key -i /etc/ssh/ssh_host_ed25519_key > /etc/age/keys.txt
   chmod 600 /etc/age/keys.txt
   ```
