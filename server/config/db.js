import mongoose from "mongoose";

async function connectDatabase() {
  const connection = await mongoose.connect(process.env.MONGO_URI);

  console.log(
    `MongoDB connected successfully: ${connection.connection.host}`
  );

  return connection;
}

export default connectDatabase;