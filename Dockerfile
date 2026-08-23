FROM nginx:alpine

COPY index.html style.css app.js protocol.js version.js /usr/share/nginx/html/

EXPOSE 80
