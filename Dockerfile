FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies for production
RUN npm ci --only=production

# Bundle app source
COPY . .

# Ensure the port matches what the app expects (we'll map Railway's PORT to this)
EXPOSE 3847

# Start the application
CMD [ "npm", "start" ]
