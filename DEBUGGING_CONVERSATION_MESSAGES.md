# Debugging Missing Conversation Messages

## Issue
Assistant messages showing as empty blue boxes in the conversation viewer.

## What Was Fixed

I've updated both the Edge Function and Python script to handle multiple message body formats that Intercom uses:

### Message Body Extraction Now Checks:
1. ✅ `part.body` - Standard HTML/text body
2. ✅ `part.text` - Bot/automated message text
3. ✅ `part.message` - Alternative message field
4. ✅ `part.blocks[]` - Structured content (cards, buttons)
5. ✅ `part.assigned_to` - Assignment messages
6. ✅ `part.conversation_rating` - Rating messages
7. ✅ `part.external_id` - External content markers

## How to Debug

### Step 1: Check Edge Function Logs

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions**
   - Click "Edge Functions" in the left sidebar
   - Click on `fetch-conversation-thread`

3. **View Logs**
   - Click the "Logs" tab
   - You should see output like:
   ```
   Fetching conversation 123456...
   Fetching from Intercom API...
   ✅ Fetched from Intercom
   Conversation has 8 parts
   Processing 8 conversation parts...
   Processing part: { part_id: 'abc123', part_type: 'comment', author_type: 'bot', author_name: 'Assistant', has_body: false, body_length: 45 }
   ✅ Parsed 9 messages total
   Message body lengths: [{"name":"Alina Akimova","length":25}, {"name":"Assistant","length":45}, ...]
   ```

4. **Look for Warnings**
   - Check for: `Warning: No body found for part`
   - This will show which fields are available in the problematic message

### Step 2: Test with Force Refresh

In your browser console, force a fresh fetch:

```javascript
// Open browser DevTools (F12)
// Go to Console tab
// Run this:

const conversationId = '215471253297267'; // Replace with your conversation ID

fetch(`${window.location.origin.replace('5173', '54321')}/functions/v1/fetch-conversation-thread`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer YOUR_ANON_KEY`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    conversation_id: conversationId,
    force_refresh: true  // Bypass cache
  })
}).then(r => r.json()).then(console.log);
```

### Step 3: Check Database

Query the database to see what's stored:

```sql
-- Check stored messages
SELECT
  part_id,
  author_name,
  author_type,
  part_type,
  LENGTH(body) as body_length,
  SUBSTRING(body, 1, 50) as body_preview
FROM conversation_messages
WHERE conversation_id = '215471253297267'
ORDER BY created_at;
```

### Step 4: Manual Python Test

Test the Python script directly:

```bash
# Fetch a specific conversation
python scripts/intercom/fetch_conversation_thread.py 215471253297267

# Check the logs for:
# "First message body length: XX"
# "Part: ... | Body length: XX"
```

## Common Issues & Solutions

### Issue 1: Empty `body` field in Intercom response

**Symptom:** Logs show `has_body: false`

**Solution:** The updated code now checks multiple fields. If still empty, the message might be in `blocks` format.

**Debug:**
```javascript
// In Edge Function logs, look for:
Warning: No body found for part {
  part_id: 'abc123',
  part_type: 'comment',
  author_type: 'bot',
  available_fields: ['id', 'created_at', 'author', 'attachments', 'blocks']
}
```

If you see `blocks` in available_fields, the message is using structured content.

### Issue 2: Cache showing old empty messages

**Symptom:** Messages appear empty even after fix

**Solution:** Clear the cache by:

1. **Force refresh in UI:**
   - Add `force_refresh: true` to the fetch request (see Step 2 above)

2. **Or delete cached data:**
   ```sql
   -- Delete cached conversation
   DELETE FROM conversation_threads WHERE conversation_id = '215471253297267';
   DELETE FROM conversation_messages WHERE conversation_id = '215471253297267';
   ```

3. **Then click "View" again** in the dashboard

### Issue 3: Bot messages have special format

**Symptom:** Only bot/assistant messages are empty

**Possible causes:**
- Fin AI messages use different structure
- Custom bot messages use `blocks` format
- Automated messages use `text` field instead of `body`

**Solution:** Already handled in the updated `extractMessageBody()` function!

## Testing the Fix

1. **Clear cache** (see above)
2. **Click "View"** on a conversation with empty messages
3. **Check Edge Function logs** for body_length values
4. **Messages should now display** with content

## If Still Not Working

### Capture Raw Intercom Response

Add this to the Edge Function temporarily:

```typescript
// After line 200 (console.log('✅ Fetched from Intercom'))
console.log('RAW CONVERSATION:', JSON.stringify(conversation, null, 2));
```

Redeploy and check logs to see the exact structure Intercom is returning.

### Check Specific Message Structure

```sql
-- Get the full_data for one conversation
SELECT full_data::json->'conversation_parts'->'conversation_parts'->0
FROM conversation_threads
WHERE conversation_id = '215471253297267';
```

This shows the exact structure of the first message part.

## Expected Behavior After Fix

✅ Customer messages should show content
✅ Assistant/bot messages should show content
✅ Internal notes should show in yellow
✅ Empty messages should show "[Message content not available]"
✅ Assignment messages should show "Assigned to X"
✅ Rating messages should show "Conversation rated: X"

## Next Steps

1. Click "View" on the problematic conversation
2. Open Supabase Edge Function logs
3. Look for the `body_length` values in logs
4. If still 0, check the "Warning: No body found" message
5. Share the `available_fields` output for further debugging

The enhanced logging will show exactly what fields are available in each message, which will help us identify the exact structure Intercom is using for your bot messages.
