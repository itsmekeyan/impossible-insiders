import json
import re

def recover_json(text: str) -> dict:
    """
    Recovers a JSON object from a string that might contain other text.
    Finds the first occurrence of '{' and the last '}' to extract the JSON part.
    """
    if not isinstance(text, str):
        return {"error": "Input is not a string"}

    try:
        # Find the JSON part of the string using a regex
        json_match = re.search(r'```json\s*(\{.*?\})\s*```', text, re.DOTALL)
        if not json_match:
            json_match = re.search(r'\{.*\}', text, re.DOTALL)

        if json_match:
            json_str = json_match.group(1) if '```json' in json_match.group(0) else json_match.group(0)
            return json.loads(json_str)
        else:
            return {"error": "No JSON object found in the response."}
    except json.JSONDecodeError as e:
        return {"error": "Failed to decode JSON", "details": str(e), "malformed_string": text}
    except Exception as e:
        return {"error": "An unexpected error occurred during JSON recovery", "details": str(e)}
