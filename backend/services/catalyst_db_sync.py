import os
import sqlite3
import tempfile
import logging
from config import config

log = logging.getLogger(__name__)

DB_PATH = config.DB_PATH
FOLDER_NAME = "Database Backups"

def get_catalyst_app():
    try:
        import zcatalyst_sdk as catalyst
        return catalyst.initialize()
    except Exception as e:
        log.warning(f"Failed to initialize zcatalyst_sdk: {e}")
        return None

def get_or_create_folder(filestore, name):
    try:
        folders = filestore.get_all_folders()
        for f in folders:
            f_dict = f.to_dict() if hasattr(f, 'to_dict') else getattr(f, '_folder_details', {})
            if f_dict.get('folder_name') == name or f_dict.get('name') == name:
                return f
        # Create it if it doesn't exist
        log.info(f"Creating folder '{name}' in File Store...")
        filestore.create_folder(name)
        # Fetch folders again to get instance with ID
        folders = filestore.get_all_folders()
        for f in folders:
            f_dict = f.to_dict() if hasattr(f, 'to_dict') else getattr(f, '_folder_details', {})
            if f_dict.get('folder_name') == name or f_dict.get('name') == name:
                return f
    except Exception as e:
        log.error(f"Error getting/creating folder '{name}': {e}")
    return None

def list_files_in_folder(folder):
    try:
        from zcatalyst_sdk._constants import RequestMethod, CredentialUser
        resp = folder._requester.request(
            method=RequestMethod.GET,
            path=f'/folder/{folder._id}/file',
            user=CredentialUser.USER
        )
        return resp.response_json.get('data', [])
    except Exception as e:
        log.error(f"Failed to list files in folder: {e}")
        return []

def download_db_from_filestore():
    """Download sentinal.db from Catalyst File Store to local disk at startup."""
    app = get_catalyst_app()
    if not app:
        return False
    try:
        filestore = app.filestore()
        folder = get_or_create_folder(filestore, FOLDER_NAME)
        if not folder:
            return False
        
        files = list_files_in_folder(folder)
        db_file_id = None
        for f in files:
            if f.get("file_name") == "sentinal.db":
                db_file_id = f.get("id")
                break
        
        if db_file_id:
            log.info(f"Downloading sentinal.db from File Store (File ID: {db_file_id})...")
            content = folder.download_file(db_file_id)
            if content:
                # Ensure data directory exists
                os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
                with open(DB_PATH, "wb") as db_f:
                    db_f.write(content)
                log.info("sentinal.db successfully restored from Catalyst File Store!")
                return True
        else:
            log.info("No sentinal.db backup found in File Store. Running with default seed database.")
    except Exception as e:
        log.error(f"Failed to sync DB from Catalyst: {e}")
    return False

def upload_db_to_catalyst():
    """Upload/Backup local sentinal.db to Catalyst File Store after writes."""
    app = get_catalyst_app()
    if not app:
        return False
    if not os.path.exists(DB_PATH):
        return False
    try:
        filestore = app.filestore()
        folder = get_or_create_folder(filestore, FOLDER_NAME)
        if not folder:
            return False

        # Read db file bytes
        with open(DB_PATH, "rb") as local_f:
            db_bytes = local_f.read()

        # List files to check for old sentinal.db
        files = list_files_in_folder(folder)
        for f in files:
            if f.get("file_name") == "sentinal.db":
                old_id = f.get("id")
                log.info(f"Deleting old sentinal.db backup (File ID: {old_id})...")
                try:
                    folder.delete_file(old_id)
                except Exception as del_err:
                    log.warning(f"Failed to delete old backup file: {del_err}")

        # Write to temp file for BufferedReader upload
        with tempfile.NamedTemporaryFile(delete=False) as tmp:
            tmp.write(db_bytes)
            tmp_name = tmp.name

        try:
            log.info("Uploading sentinal.db to Catalyst File Store...")
            with open(tmp_name, "rb") as f_read:
                folder.upload_file("sentinal.db", f_read)
            log.info("sentinal.db backup upload completed successfully!")
            return True
        finally:
            os.remove(tmp_name)
    except Exception as e:
        log.error(f"Failed to backup DB to Catalyst: {e}")
    return False
