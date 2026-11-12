"""
ICICI Bank Direct PG (Orange PG) - Whitelisted Domain Verifier
Usage:
    python scripts/check_whitelisted_domain.py
    python scripts/check_whitelisted_domain.py https://mycustomdomain.com
"""

import sys
import json
import hashlib
import hmac
import datetime
import ssl
import time
import urllib.request

ctx = ssl.create_default_context()

MID = '100000000553470'
AGG_ID = '100000000553469'
SECRET = '863edfb6-97c3-4944-b7d8-021fd7248037'
URL = 'https://pgpay.icicibank.com/pg/api/v2/initiateSale'

def gen_hash(payload, secret):
    keys = sorted(payload.keys())
    plain = ''.join(str(payload[k]) for k in keys if k != 'secureHash' and payload[k] is not None and str(payload[k]) != '')
    return hmac.new(secret.encode('utf-8'), plain.encode('utf-8'), hashlib.sha256).hexdigest()

CANDIDATES = [
    'https://havocrcfunzone.com',
    'https://www.havocrcfunzone.com',
    'https://havochobby.com',
    'https://www.havochobby.com',
    'https://havochobbycenter.com',
    'https://www.havochobbycenter.com',
    'https://havoc-rc-funzone.vercel.app',
    'https://havoc-rc-funzone.onrender.com',
    'https://whynotdev.in',
    'http://localhost:3000'
]

def check_domain(domain: str) -> tuple[bool, str]:
    millis = str(int(time.time() * 1000))[-10:]
    payload = {
        'merchantId': MID,
        'aggregatorID': AGG_ID,
        'merchantTxnNo': f"CK_{millis}",
        'amount': '1.00',
        'currencyCode': '356',
        'payType': '0',
        'customerEmailID': 'support@havocrcfunzone.com',
        'customerMobileNo': '9876543210',
        'customerName': 'Domain Verification Check',
        'transactionType': 'SALE',
        'txnDate': datetime.datetime.now().strftime('%Y%m%d%H%M%S'),
        'returnURL': f"{domain.rstrip('/')}/api/payment/icici/callback"
    }
    payload['secureHash'] = gen_hash(payload, SECRET)
    
    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            redirect_uri = data.get('redirectURI')
            tran_ctx = data.get('tranCtx')
            
            if not redirect_uri or not tran_ctx:
                return False, f"initiateSale returned error code: {data.get('responseCode')}"
                
            target_url = f"{redirect_uri}?tranCtx={tran_ctx}"
            req2 = urllib.request.Request(
                target_url,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req2, context=ctx, timeout=10) as resp2:
                body = resp2.read().decode('utf-8', errors='ignore')
                if 'DOMAIN VALIDATION FAIL' in body:
                    return False, "DOMAIN VALIDATION FAIL (Domain rejected by ICICI PG whitelist)"
                else:
                    return True, "WHITELISTED & ACTIVE (Payment page loaded successfully)"
    except Exception as e:
        return False, f"Connection/API error: {e}"

def main():
    domains_to_test = sys.argv[1:] if len(sys.argv) > 1 else CANDIDATES
    print("=" * 65)
    print(" ICICI Bank Direct PG (Orange PG) - Domain Whitelist Probe")
    print(f" Merchant: HAVOC HOBBY CENTER PRIVATE LIMITED (MID: {MID})")
    print("=" * 65)
    
    whitelisted = []
    for d in domains_to_test:
        success, message = check_domain(d)
        tag = "[MATCH!]" if success else "[FAIL]"
        print(f"{tag:<8} {d:<38} -> {message}")
        if success:
            whitelisted.append(d)
        time.sleep(0.2)
        
    print("\n" + "=" * 65)
    if whitelisted:
        print(f"RESULT: Found {len(whitelisted)} whitelisted domain(s):")
        for w in whitelisted:
            print(f"  * {w}")
    else:
        print("RESULT: None of the tested domains are whitelisted in ICICI Live PG.")
        print("This indicates that the ICICI backend for MID 100000000553470 has")
        print("NOT yet configured a whitelisted website domain in their database.")
    print("=" * 65)

if __name__ == '__main__':
    main()
