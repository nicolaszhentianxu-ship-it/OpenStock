import mongoose from "mongoose";
import dns from "dns";
 
const MONGODB_URI = process.env.MONGODB_URI;
 
try {
    // Prefer IPv4: avoids querySrv ECONNREFUSED on hosts with broken IPv6.
    if (dns.setDefaultResultOrder) {
        dns.setDefaultResultOrder("ipv4first");
    }
 
    // Only override the DNS resolver when explicitly asked to, e.g.
    //   MONGODB_DNS_SERVERS="8.8.8.8,1.1.1.1"
    // Hardcoding a resolver the host cannot reach breaks mongodb+srv://
    // lookups outright, so the platform default is the safer starting point.
    const customDns = process.env.MONGODB_DNS_SERVERS;
    if (customDns) {
        const servers = customDns.split(",").map((s) => s.trim()).filter(Boolean);
        if (servers.length > 0) {
            dns.setServers(servers);
            console.log("MongoDB: custom DNS resolver applied");
        }
    }
} catch (e) {
    console.error("Failed to apply DNS settings:", e);
}
 
/** Strip credentials from a connection string before it reaches any log. */
const redactUri = (uri: string) => uri.replace(/\/\/[^@/]*@/, "//<credentials>@");
 
declare global {
    var mongooseCache: {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
    }
}
 
let cached = global.mongooseCache;
 
if (!cached) {
    cached = global.mongooseCache = { conn: null, promise: null };
}
 
export const connectToDatabase = async () => {
    if (!MONGODB_URI) {
        throw new Error("MongoDB URI is missing");
    }
 
    if (cached.conn) return cached.conn;
 
    if (!cached.promise) {
        cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false, family: 4 });
    }
 
    try {
        cached.conn = await cached.promise;
    }
    catch (err) {
        cached.promise = null;
        throw err;
    }
 
    console.log(`MongoDB connected to ${redactUri(MONGODB_URI)} in ${process.env.NODE_ENV}`);
    return cached.conn;
}
