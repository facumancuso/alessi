#!/usr/bin/env python3
"""
Migración directa de datos de Firestore export a MongoDB
Convierte los archivos exportados de Firestore directamente a MongoDB
"""

import json
import struct
from pathlib import Path
import sys
import subprocess

# First, install pymongo if not already installed
try:
    from pymongo import MongoClient
    import bcrypt
except ImportError:
    print("📦 Instalando pymongo...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pymongo", "bcrypt", "-q"])
    from pymongo import MongoClient
    import bcrypt

MONGODB_URI = "mongodb://localhost:27017"
DB_NAME = "alessi2026"

def convert_firestore_value(value):
    """Convierte valores de Firestore al formato de MongoDB"""
    if isinstance(value, dict):
        if 'stringValue' in value:
            return value['stringValue']
        elif 'integerValue' in value:
            return int(value['integerValue'])
        elif 'doubleValue' in value:
            return float(value['doubleValue'])
        elif 'booleanValue' in value:
            return value['booleanValue']
        elif 'timestampValue' in value:
            return value['timestampValue']
        elif 'nullValue' in value:
            return None
        elif 'arrayValue' in value:
            return [convert_firestore_value(v) for v in value.get('values', [])]
        elif 'mapValue' in value:
            result = {}
            for key, val in value['mapValue'].get('fields', {}).items():
                result[key] = convert_firestore_value(val)
            return result
        else:
            # Asume que es un mapa directo
            result = {}
            for key, val in value.items():
                result[key] = convert_firestore_value(val)
            return result
    return value

def parse_firestore_export_file(filepath):
    """Lee un archivo de exportación de Firestore y extrae los documentos"""
    documents_by_collection = {}
    
    with open(filepath, 'rb') as f:
        try:
            while True:
                # Lee la longitud del mensaje protobuf (varint de 32 bits)
                length_bytes = []
                for _ in range(5):  # máximo 5 bytes para un varint
                    byte = f.read(1)
                    if not byte:
                        return documents_by_collection
                    length_bytes.append(byte[0])
                    if byte[0] & 0x80 == 0:
                        break
                
                # Decodifica el varint
                length = 0
                for i, byte in enumerate(length_bytes):
                    length |= (byte & 0x7f) << (7 * i)
                
                # Lee el mensaje protobuf
                message_data = f.read(length)
                if len(message_data) < length:
                    break
                
                # Intenta extraer información del mensaje
                try:
                    # Busca strings que parezcan ser paths de Firestore
                    text = message_data.decode('utf-8', errors='ignore')
                    
                    # Patrones para extraer colecciones y documentos
                    if 'documents/' in text:
                        # Extrae la ruta del documento
                        parts = text.split('documents/')
                        if len(parts) > 1:
                            path = parts[1].split('\x00')[0]
                            path_components = path.split('/')
                            
                            if len(path_components) >= 2:
                                collection = path_components[0]
                                doc_id = path_components[1] if len(path_components) > 1 else None
                                
                                # Intenta extraer campos JSON
                                if '{' in text:
                                    json_start = text.find('{')
                                    json_end = text.rfind('}') + 1
                                    if json_start >= 0 and json_end > json_start:
                                        try:
                                            json_str = text[json_start:json_end]
                                            fields = json.loads(json_str)
                                            
                                            if collection not in documents_by_collection:
                                                documents_by_collection[collection] = []
                                            
                                            doc_data = convert_firestore_value(fields)
                                            documents_by_collection[collection].append((doc_id, doc_data))
                                        except json.JSONDecodeError:
                                            pass
                except Exception:
                    pass
        except EOFError:
            pass
    
    return documents_by_collection

def migrate_from_firestore_export():
    """Realiza la migración desde archivos de exportación de Firestore a MongoDB"""
    print("🚀 Iniciando migración desde Firestore export a MongoDB\n")
    
    # Conectar a MongoDB
    print("🔌 Conectando a MongoDB...")
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        client.admin.command('ping')
        print(f"✅ Conectado a: {MONGODB_URI}\n")
    except Exception as e:
        print(f"❌ Error conectando a MongoDB: {e}")
        print("   Asegúrate de que MongoDB esté ejecutándose")
        return False
    
    db = client[DB_NAME]
    
    # Ruta a los archivos de exportación
    export_path = Path(__file__).parent / "firebase_data" / "firestore_export" / "all_namespaces" / "all_kinds"
    
    if not export_path.exists():
        print(f"❌ No se encontró la ruta de exportación: {export_path}")
        return False
    
    print(f"📂 Leyendo archivos de: {export_path}\n")
    
    all_docs = {}
    
    # Lee todos los archivos output-*
    for output_file in sorted(export_path.glob("output-*")):
        print(f"   Procesando {output_file.name}...")
        try:
            docs = parse_firestore_export_file(output_file)
            for collection, doc_list in docs.items():
                if collection not in all_docs:
                    all_docs[collection] = []
                all_docs[collection].extend(doc_list)
        except Exception as e:
            print(f"   ⚠️ Error en {output_file.name}: {e}")
    
    print()
    
    # Colecciones a migrar (en orden específico)
    collections = ['services', 'products', 'clients', 'users', 'appointments', 'settings']
    
    stats = {}
    
    for collection in collections:
        if collection not in all_docs or not all_docs[collection]:
            print(f"   ℹ️ {collection}: sin documentos")
            stats[collection] = 0
            continue
        
        print(f"📦 Migrando {collection}...")
        
        # Limpia la colección
        db[collection].delete_many({})
        
        # Inserta documentos
        docs_to_insert = []
        for doc_id, doc_data in all_docs[collection]:
            # No incluya el _id generado por MongoDB para que cree uno nuevo
            docs_to_insert.append(doc_data)
        
        if docs_to_insert:
            result = db[collection].insert_many(docs_to_insert)
            print(f"   ✅ {collection}: {len(result.inserted_ids)} documentos migrados")
            stats[collection] = len(result.inserted_ids)
        else:
            stats[collection] = 0
    
    # Resumen
    print("\n📊 Resumen:")
    for collection in collections:
        print(f"   {collection:15} {stats[collection]:5}")
    
    total = sum(stats.values())
    print(f"\n   TOTAL:          {total:5} documentos migrados")
    
    client.close()
    
    if total > 0:
        print("\n🎉 Migración completada exitosamente!")
        return True
    else:
        print("\n⚠️ No se migró ningún documento. Los archivos pueden estar vacíos o en formato diferente.")
        return False

if __name__ == "__main__":
    success = migrate_from_firestore_export()
    sys.exit(0 if success else 1)
