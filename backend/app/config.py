import os
import logging
from dotenv import load_dotenv
from groq import Groq

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("VoiceForgeOps")

# Load environment variables
load_dotenv()

# Groq Client Initialization
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    logger.warning("WARNING: GROQ_API_KEY environment variable is not set. Groq API calls will fail.")
else:
    logger.info("Groq API client initialized successfully.")

# Securely instantiate Groq client
groq_client = Groq(api_key=GROQ_API_KEY or "")

# Supabase Client Initialization (Graceful Fallback)
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase_client = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client
        supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.info("Supabase client initialized successfully.")
    except Exception as e:
        logger.warning(f"Failed to initialize Supabase client: {str(e)}. Continuing in fallback mode.")
else:
    logger.warning("Supabase URL or Key not set. Database logging is disabled.")

# Make Webhook URL
MAKE_WEBHOOK_URL = os.getenv("MAKE_WEBHOOK_URL")
if not MAKE_WEBHOOK_URL:
    logger.warning("WARNING: MAKE_WEBHOOK_URL environment variable is not set. Webhook dispatching is disabled.")
