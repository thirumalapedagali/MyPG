# MyPG
Manage the Stay 

## Running with the backend

1. Start the Spring Boot API (port 8083): `cd backend; ./mvnw spring-boot:run`
2. Start the app: `cd app; npx expo start`
3. The app finds the API at `<Metro host>:8083` automatically. Override with `EXPO_PUBLIC_API_URL=http://<ip>:8083` if needed (Android emulator uses `10.0.2.2`).
4. Phone and computer must be on the same network.

