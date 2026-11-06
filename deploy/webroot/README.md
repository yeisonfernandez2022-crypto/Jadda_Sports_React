# Webroot de desafíos ACME (docs/implantacion/06-despliegue-oracle.md §8)
#
# Certbot corre en el ANFITRION y escribe aquí los archivos de reto:
#
#   sudo apt -y install certbot
#   sudo certbot certonly --webroot -w deploy/webroot -d TU_DOMINIO \
#     --non-interactive --agree-tos -m TU_EMAIL \
#     --deploy-hook "docker exec jadda_web_prod nginx -s reload"
#
# El nginx del borde sirve /.well-known/acme-challenge/ desde este punto
# (mount ./webroot:/var/www en deploy/compose.prod.yaml). Tras cada
# RENOVACION el deploy-hook recarga nginx y se actualizan los pem copiados a
# deploy/certs/ (ver §8 para el hook completo con la copia). Nada de este
# contenido se versiona salvo este README.
