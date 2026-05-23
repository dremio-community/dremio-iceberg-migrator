import requests
import json
import urllib.parse
from .db import get_setting

def _get_base_url():
    url = get_setting('dremio_url', 'http://localhost:9047')
    return url.rstrip('/')

def _get_headers():
    pat = get_setting('dremio_pat')
    if pat:
        return {
            'Authorization': f'Bearer {pat}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
    
    # Fallback to username/password login
    username = get_setting('dremio_username')
    password = get_setting('dremio_password')
    if username and password:
        base_url = _get_base_url()
        login_resp = requests.post(
            f"{base_url}/apiv2/login",
            json={"userName": username, "password": password},
            headers={'Content-Type': 'application/json'}
        )
        if login_resp.status_code == 200:
            token = login_resp.json().get('token')
            return {
                'Authorization': f'_dremio{token}',
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
    
    return {'Content-Type': 'application/json', 'Accept': 'application/json'}

def _get_api_path(base_url, path):
    project_id = get_setting('dremio_project_id')
    if project_id:
        # Dremio Cloud uses /v0/projects/{projectId}/...
        # Map /api/v3/ to /v0/projects/{projectId}/
        cloud_path = path.replace('/api/v3/', f'/v0/projects/{project_id}/')
        return f"{base_url}{cloud_path}"
    return f"{base_url}{path}"

def test_connection():
    try:
        base_url = _get_base_url()
        headers = _get_headers()
        url = _get_api_path(base_url, '/api/v3/catalog')
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            return True, "Connection successful"
        return False, f"Failed with status code: {resp.status_code}"
    except Exception as e:
        return False, str(e)

def get_catalog_root():
    """Returns top level sources, spaces, and homes."""
    base_url = _get_base_url()
    headers = _get_headers()
    url = _get_api_path(base_url, '/api/v3/catalog')
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        return resp.json().get('data', [])
    return []

def get_catalog_by_path(path_list):
    """Returns children of a specific catalog path."""
    base_url = _get_base_url()
    headers = _get_headers()
    
    encoded_path = '/'.join([urllib.parse.quote(p, safe='') for p in path_list])
    url = _get_api_path(base_url, f'/api/v3/catalog/by-path/{encoded_path}')
    
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        return resp.json()
    return None

def resolve_physical_dataset_uri(path_list):
    """Attempts to auto-resolve a Dremio path to its physical S3/ADLS/Local URI."""
    dataset = get_catalog_by_path(path_list)
    if not dataset or 'entityType' not in dataset:
        raise Exception(f"Could not find dataset at path: {'.'.join(path_list)}")
        
    if dataset['entityType'] not in ['dataset', 'physicalDataset', 'file']:
        raise Exception("Selected path is not a dataset or file.")
        
    # Get location
    format_info = dataset.get('format', {})
    location = format_info.get('location', '')
    
    if not location and 'path' in dataset:
        # Fallback if location isn't explicit
        location = '/' + '/'.join(dataset['path'][1:])
        
    # Get source configuration
    source = get_catalog_by_path([path_list[0]])
    if not source:
        raise Exception("Could not find source details to resolve URI.")
        
    source_type = source.get('type', '')
    config = source.get('config', {})
    
    if source_type in ['S3', 'AWS']:
        if location.startswith('/'):
            location = location[1:]
            
        bucket = ""
        if 'externalBucketList' in config and config['externalBucketList']:
            bucket = config['externalBucketList'][0]
        elif 'bucketName' in config:
            bucket = config['bucketName']
            
        if bucket:
            # PySpark uses s3a://
            return f"s3a://{bucket}/{location}"
        else:
            raise Exception("Could not automatically determine the S3 bucket name from the Dremio source. Please provide the Manual URI.")
            
    elif source_type in ['NAS', 'LOCAL']:
        return f"file://{location}"
        
    else:
        raise Exception(f"Auto-resolve is not yet supported for Dremio source type '{source_type}'. Please provide the Manual URI.")

def submit_job(sql):
    """Submits a SQL query and returns the job ID."""
    base_url = _get_base_url()
    headers = _get_headers()
    payload = {"sql": sql}
    
    url = _get_api_path(base_url, '/api/v3/sql')
    resp = requests.post(url, headers=headers, json=payload)
    if resp.status_code == 200:
        return resp.json().get('id')
    
    error_msg = resp.text
    try:
        error_msg = resp.json().get('errorMessage', resp.text)
    except:
        pass
    raise Exception(f"Failed to submit job: {error_msg}")

def get_job_status(job_id):
    """Gets the status of a job."""
    base_url = _get_base_url()
    headers = _get_headers()
    
    url = _get_api_path(base_url, f'/api/v3/job/{job_id}')
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        return resp.json()
    return None

def get_job_results(job_id):
    """Gets the results of a completed job."""
    base_url = _get_base_url()
    headers = _get_headers()
    
    url = _get_api_path(base_url, f'/api/v3/job/{job_id}/results?limit=10')
    resp = requests.get(url, headers=headers)
    if resp.status_code == 200:
        return resp.json()
    return None
