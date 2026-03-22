import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
// We try to initialize with default credentials (works on GCP)
let databaseId = "(default)";
try {
  const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
  databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  console.log(`Firebase Admin initialized successfully for project ${firebaseConfig.projectId} and database ${databaseId}.`);
} catch (err) {
  console.error("Firebase Admin initialization failed:", err);
}

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

async function startServer() {
  console.log("Starting Express server...");
  const app = express();
  
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true, parameterLimit: 100000 }));
  
  const PORT = 3000;

  // Admin User Management Endpoints
  app.post("/api/admin/create-user", async (req, res) => {
    const { email, password, userData } = req.body;
    console.log(`Creating user: ${email}`);
    try {
      // 1. Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName: `${userData.first_name} ${userData.family_name}`,
      });

      // 2. Create user in Firestore
      const db = getFirestore(databaseId);
      await db.collection('users').doc(userRecord.uid).set({
        ...userData,
        uid: userRecord.uid,
        email,
        password, // Store for admin visibility as requested
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`User created successfully: ${userRecord.uid}`);
      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/update-user", async (req, res) => {
    const { uid, password, userData } = req.body;
    console.log(`Updating user: ${uid}`);
    
    if (!uid) {
      return res.status(400).json({ error: "User ID is required" });
    }

    try {
      const auth = admin.auth();
      const db = getFirestore(databaseId);

      const updatePayload: any = {};
      
      // Only include fields that are present in userData
      // and remove fields that shouldn't be updated directly like 'id' or 'uid'
      const allowedFields = [
        'first_name', 'father_name', 'grandfather_name', 'family_name', 
        'username', 'role', 'grade', 'school_name', 'email'
      ];
      
      allowedFields.forEach(field => {
        if (userData[field] !== undefined) {
          updatePayload[field] = userData[field];
        }
      });

      // 1. Update Auth if password provided
      if (password && password.trim().length > 0) {
        if (password.length < 6) {
          return res.status(400).json({ error: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" });
        }
        console.log(`Updating password in Auth for user: ${uid}`);
        await auth.updateUser(uid, { password });
        updatePayload.password = password; // Also update in Firestore for admin visibility
      }

      // 2. Update Firestore
      console.log(`Updating Firestore for user: ${uid}, fields:`, Object.keys(updatePayload));
      await db.collection('users').doc(uid).update(updatePayload);

      console.log(`User updated successfully: ${uid}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/delete-user", async (req, res) => {
    const { uid } = req.body;
    console.log(`Deleting user: ${uid}`);
    try {
      await admin.auth().deleteUser(uid);
      await getFirestore(databaseId).collection('users').doc(uid).delete();
      console.log(`User deleted successfully: ${uid}`);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Configure multer for file storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ 
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit per file
  });

  // Serve uploads directory statically
  app.use('/uploads', express.static(uploadsDir));

  // File upload endpoint
  app.post("/api/upload", upload.single('file'), (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ url: fileUrl });
    } catch (error: any) {
      console.error("Upload error:", error.message);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Custom error handler for JSON parsing errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
      console.error("JSON Parsing Error:", err.message);
      return res.status(400).json({ error: "Invalid JSON format in request body." });
    }
    next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite server...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      console.log("Vite server initialized.");
      app.use(vite.middlewares);
    } catch (viteError) {
      console.error("Failed to initialize Vite server:", viteError);
      process.exit(1);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
