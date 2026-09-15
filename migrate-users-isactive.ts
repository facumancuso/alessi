import 'dotenv/config';
import mongoose from 'mongoose';
import { connectToDatabase } from './src/lib/mongodb';
import { UserModel } from './src/lib/models';

async function run() {
  await connectToDatabase();

  const legacyFilter = {
    $or: [
      { isActive: { $exists: false } },
      { isActive: null },
    ],
  };

  const beforeCount = await UserModel.countDocuments(legacyFilter);
  if (beforeCount === 0) {
    console.log('No hay usuarios legacy para normalizar.');
    return;
  }

  const result = await UserModel.updateMany(legacyFilter, {
    $set: { isActive: true },
  });

  console.log(`Usuarios legacy detectados: ${beforeCount}`);
  console.log(`Usuarios actualizados: ${result.modifiedCount}`);
}

run()
  .catch((error) => {
    console.error('Error ejecutando migracion de usuarios isActive:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
