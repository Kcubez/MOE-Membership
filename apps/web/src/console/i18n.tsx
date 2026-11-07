import { createContext, useContext } from 'react';
export type Language = 'en' | 'my';
export const LanguageContext = createContext<Language>('en');
const my: Record<string, string> = {
  'Your memberships, visits and attendance in one place.':
    'သင်၏ အသင်းဝင်မှု၊ လက်ကျန်အကြိမ်နှင့် တက်ရောက်မှုများကို ဤနေရာတွင် ကြည့်နိုင်ပါသည်။',
  'Show this QR to staff at your meetup.':
    'တွေ့ဆုံပွဲတွင် ဤ QR ကို ဝန်ထမ်းအား ပြပါ။',
  'No membership assigned yet. Please contact MOE.':
    'အသင်းဝင်မှု မသတ်မှတ်ရသေးပါ။ MOE သို့ ဆက်သွယ်ပါ။',
  'No attendance records yet.': 'တက်ရောက်မှု မှတ်တမ်း မရှိသေးပါ။',
  'Load more': 'ထပ်ကြည့်မည်',
  'QR temporarily unavailable': 'QR ကို ယာယီ မရနိုင်ပါ',

  'Select an account': 'အကောင့် ရွေးပါ',
  'Select an available plan': 'အသုံးပြုနိုင်သော အစီအစဉ် ရွေးပါ',
  'Search if your plan is not in the first 100 results.':
    'ပထမရလဒ် ၁၀၀ တွင် မတွေ့ပါက အစီအစဉ်အမည်ဖြင့် ရှာပါ။',
  'Select a plan to see its quota.': 'အကြိမ်ရေကို ကြည့်ရန် အစီအစဉ် ရွေးပါ။',
  'No unused visits are carried forward. Both dates must be entered explicitly.':
    'မသုံးရသေးသော အကြိမ်များကို နောက်ကာလသို့ မသယ်ဆောင်ပါ။ စရက်နှင့် ဆုံးရက် နှစ်ခုလုံး ထည့်ပါ။',
  'Choose an account and plan, then enter both dates yourself.':
    'အကောင့်နှင့် အစီအစဉ် ရွေးပြီး စရက်နှင့် ဆုံးရက်ကို ထည့်ပါ။',

  'Memberships can only be assigned or renewed for member accounts.':
    'အသင်းဝင်အကောင့်များအတွက်သာ အသင်းဝင်ကာလ သတ်မှတ်ခြင်း သို့မဟုတ် သက်တမ်းတိုးခြင်း လုပ်နိုင်ပါသည်။',
  'Showing up to 20 enabled members. Search to find another member.':
    'အသုံးပြုနိုင်သော အသင်းဝင် ၂၀ ဦးအထိ ပြထားပါသည်။ အခြားအသင်းဝင်ကို ရှာဖွေပါ။',

  'Cancel attendance': 'တက်ရောက်မှု ပယ်ဖျက်ရန်',
  'Attendance cancelled': 'တက်ရောက်မှု ပယ်ဖျက်ပြီးပါပြီ',
  'Already cancelled': 'ပယ်ဖျက်ပြီးဖြစ်ပါသည်',
  'One visit was restored to the original membership.':
    'မူလအသင်းဝင်ကာလသို့ တစ်ကြိမ် ပြန်ပေါင်းပြီးပါပြီ။',
  'Previously cancelled. No additional visit was restored.':
    'အရင်က ပယ်ဖျက်ပြီးဖြစ်ပါသည်။ တစ်ကြိမ် ထပ်မပေါင်းပါ။',
  'Cancelled by': 'ပယ်ဖျက်သူ',
  'Cancel this attendance and restore one visit to its original membership. The history will be retained.':
    'ဤတက်ရောက်မှုကို ပယ်ဖျက်ပြီး မူလအသင်းဝင်ကာလသို့ တစ်ကြိမ် ပြန်ပေါင်းပါမည်။ မှတ်တမ်းကို ဆက်ထိန်းထားပါမည်။',
  'Restoring a visit does not extend or reactivate an expired or cancelled membership.':
    'တစ်ကြိမ်ပြန်ပေါင်းခြင်းသည် သက်တမ်းတိုးခြင်း သို့မဟုတ် ပယ်ဖျက်ပြီးအသင်းဝင်ကာလကို ပြန်ဖွင့်ခြင်း မဟုတ်ပါ။',
  'Cancellation reason': 'ပယ်ဖျက်ရသည့်အကြောင်းရင်း',
  'Result not confirmed. Retry this cancellation; a visit can only be restored once.':
    'ရလဒ် မအတည်ပြုနိုင်သေးပါ။ ဤပယ်ဖျက်မှုကို ပြန်စမ်းပါ။ တစ်ကြိမ်သာ ပြန်ပေါင်းနိုင်ပါသည်။',
  'Retry cancellation': 'ပယ်ဖျက်မှု ပြန်စမ်းမည်',
  'Confirm cancellation': 'ပယ်ဖျက်မှု အတည်ပြုမည်',

  'Choose a session': 'တွေ့ဆုံပွဲ ရွေးပါ',

  'Backfill attendance': 'တက်ရောက်မှု နောက်ကြောင်းပြန်ဖြည့်ရန်',
  'Record actual historical attendance. One available visit is deducted only after confirmation.':
    'အမှန်တကယ် တက်ရောက်ခဲ့မှုကို ပြန်ဖြည့်ပါ။ အတည်ပြုပြီးမှ လက်ကျန်တစ်ကြိမ် လျှော့ပါမည်။',
  'Backfill saved': 'နောက်ကြောင်းပြန်ဖြည့်ပြီးပါပြီ',
  'Original attendance was cancelled': 'မူလတက်ရောက်မှုကို ပယ်ဖျက်ပြီးဖြစ်ပါသည်',
  'Duplicate requests do not deduct another visit.':
    'ထပ်တင်သော request များအတွက် တစ်ကြိမ် ထပ်မလျှော့ပါ။',
  'Find sessions': 'တွေ့ဆုံပွဲ ရှာမည်',
  'More sessions': 'နောက်ထပ် တွေ့ဆုံပွဲများ',
  'No sessions found for this date. Adjust the date or search.':
    'ဤရက်တွင် တွေ့ဆုံပွဲ မတွေ့ပါ။ ရက် သို့မဟုတ် ရှာဖွေမှုကို ပြင်ပါ။',
  'Search accounts': 'အကောင့် ရှာရန်',
  'Find accounts': 'အကောင့် ရှာမည်',
  'More accounts': 'နောက်ထပ် အကောင့်များ',
  'Choose an account': 'အကောင့် ရွေးပါ',
  'No accounts match this search.': 'ရှာဖွေမှုနှင့် ကိုက်ညီသော အကောင့် မရှိပါ။',
  'Attendance time (Myanmar)': 'တက်ရောက်ချိန် (မြန်မာစံတော်ချိန်)',
  'Eligibility uses the selected historical date and current remaining visits. Closed sessions are allowed.':
    'အကျုံးဝင်မှုကို ရွေးထားသော အရင်ရက်နှင့် လက်ရှိလက်ကျန်ဖြင့် စစ်ပါမည်။ ပိတ်ထားသောပွဲကိုလည်း ဖြည့်နိုင်ပါသည်။',
  'Result not confirmed. Retry the same backfill to avoid recording it twice.':
    'ရလဒ် မအတည်ပြုနိုင်သေးပါ။ နှစ်ကြိမ်မဖြစ်စေရန် ဤဖြည့်သွင်းမှုကိုသာ ပြန်စမ်းပါ။',
  'Retry same backfill': 'ဤဖြည့်သွင်းမှုကို ပြန်စမ်းမည်',
  'Save backfill': 'နောက်ကြောင်းပြန်ဖြည့်မည်',
  'Backfill requires a historical session and matching attendance date in Myanmar time.':
    'အရင်ရက် တွေ့ဆုံပွဲနှင့် မြန်မာစံတော်ချိန်အရ ကိုက်ညီသော တက်ရောက်ရက် လိုပါသည်။',
  'This request ID was already used for a different operation.':
    'ဤ request ID ကို အခြားလုပ်ဆောင်မှုအတွက် သုံးပြီးဖြစ်ပါသည်။',
  Done: 'ပြီးပြီ',

  Status: 'အခြေအနေ',
  'Records on this page': 'ဤစာမျက်နှာရှိ မှတ်တမ်းများ',

  'Meetup dates use Myanmar time. Live check-ins require an open session on its meetup date.':
    'တွေ့ဆုံရက်များသည် မြန်မာစံတော်ချိန်ဖြစ်ပါသည်။ စကင်ဖတ်ရန် တွေ့ဆုံရက် ဖြစ်ရမည်ဖြစ်ပြီး ပွဲဖွင့်ထားရပါမည်။',
  'Closing prevents new check-ins. Existing records are retained.':
    'ပိတ်ထားပါက တက်ရောက်မှုအသစ် မမှတ်တမ်းတင်နိုင်ပါ။ ရှိပြီးမှတ်တမ်းများ ဆက်ရှိပါမည်။',
  'Opening does not record attendance. Live scanning is restricted to the meetup date.':
    'ပွဲဖွင့်ရုံဖြင့် တက်ရောက်မှု မမှတ်တမ်းတင်ပါ။ တွေ့ဆုံရက်တွင်သာ စကင်ဖတ်နိုင်ပါသည်။',
  'Choose an assigned session in the QR scanner to record attendance.':
    'တက်ရောက်မှုမှတ်တမ်းတင်ရန် QR စကင်နာတွင် တာဝန်ပေးထားသော တွေ့ဆုံပွဲကို ရွေးပါ။',

  'Attendance history': 'တက်ရောက်မှု မှတ်တမ်း',
  'Review check-ins and retained corrections. Dates use Myanmar time.':
    'တက်ရောက်မှုနှင့် ပြင်ဆင်မှုမှတ်တမ်းများကို ကြည့်ပါ။ ရက်စွဲများသည် မြန်မာစံတော်ချိန် ဖြစ်ပါသည်။',
  'Name, member number, plan or session':
    'အမည်၊ အသင်းဝင်နံပါတ်၊ အစီအစဉ် သို့မဟုတ် တွေ့ဆုံပွဲ',
  Method: 'မှတ်တမ်းတင်နည်း',
  'All methods': 'နည်းလမ်းအားလုံး',
  Effective: 'အကျုံးဝင်',
  Scan: 'စကင်ဖတ်ခြင်း',
  Backfill: 'နောက်ကြောင်းပြန် ဖြည့်ခြင်း',
  'Apply filters': 'စစ်ထုတ်မည်',
  'Clear filters': 'စစ်ထုတ်မှု ရှင်းမည်',
  'No attendance matches these filters.':
    'ဤစစ်ထုတ်မှုနှင့် ကိုက်ညီသော တက်ရောက်မှု မရှိပါ။',
  'Plan / session': 'အစီအစဉ် / တွေ့ဆုံပွဲ',
  'Attendance time': 'တက်ရောက်ချိန်',
  'Recorded by': 'မှတ်တမ်းတင်သူ',
  Cancellation: 'ပယ်ဖျက်မှု',

  'Camera access requires HTTPS or localhost. You can scan an image instead.':
    'ကင်မရာအတွက် HTTPS သို့မဟုတ် localhost လိုပါသည်။ QR ပုံကို ဖတ်နိုင်ပါသည်။',
  'Choose a PNG or JPEG image smaller than 10 MB.':
    '10 MB ထက်ငယ်သော PNG သို့မဟုတ် JPEG ပုံကို ရွေးပါ။',
  'No readable QR was found in this image.':
    'ဤပုံတွင် ဖတ်ရှုနိုင်သော QR မတွေ့ပါ။',
  'Unable to start the camera. Check permissions or scan an image.':
    'ကင်မရာ ဖွင့်၍ မရပါ။ ခွင့်ပြုချက်ကို စစ်ပါ သို့မဟုတ် QR ပုံကို ရွေးပါ။',
  'No camera was found. You can scan an image instead.':
    'ကင်မရာ မတွေ့ပါ။ QR ပုံကို ဖတ်နိုင်ပါသည်။',
  'Camera permission was denied. Allow access or scan an image.':
    'ကင်မရာ အသုံးပြုခွင့် မရပါ။ ခွင့်ပြုပါ သို့မဟုတ် QR ပုံကို ရွေးပါ။',
  'Result not confirmed. Retry this same scan after reconnecting; do not create a new request.':
    'ရလဒ်ကို အတည်မပြုနိုင်သေးပါ။ အင်တာနက် ပြန်ရပါက ဤ scan ကိုသာ ပြန်စစ်ပါ။',
  'Verify the person matches the member name and number. Live scanning is limited to the session meetup date.':
    'Member အမည်နှင့် နံပါတ်ကို လူနှင့် တိုက်စစ်ပါ။ တွေ့ဆုံမည့်ရက်တွင်သာ တိုက်ရိုက် စကင်ဖတ်နိုင်ပါသည်။',
  'Showing up to 100 open sessions for today in Myanmar time. Search to narrow the list.':
    'မြန်မာစံတော်ချိန် ယနေ့အတွက် ဖွင့်ထားသည့် တွေ့ဆုံပွဲ ၁၀၀ အထိ ပြထားပါသည်။ ရှာဖွေ၍ ရွေးနိုင်ပါသည်။',
  'No open sessions for today. Ask Admin to create, open or assign a session.':
    'ယနေ့အတွက် ဖွင့်ထားသော တွေ့ဆုံပွဲ မရှိပါ။ Admin ကို ဆက်သွယ်ပါ။',
  'This session is no longer available to you.':
    'ဤတွေ့ဆုံပွဲကို သင် ဝင်ခွင့်မရှိတော့ပါ။',
  'No visits remain for this membership.':
    'ဤ membership တွင် တက်ရောက်ခွင့် မကျန်တော့ပါ။',
  'No eligible membership for this session.':
    'ဤတွေ့ဆုံပွဲအတွက် အသုံးပြုနိုင်သော membership မရှိပါ။',
  'Live check-in is only available on the meetup date.':
    'တွေ့ဆုံမည့်ရက်တွင်သာ တိုက်ရိုက် စကင်ဖတ်နိုင်ပါသည်။',
  'This session is closed.': 'ဤတွေ့ဆုံပွဲကို ပိတ်ထားပါသည်။',
  'This account cannot check in.':
    'ဤ account ဖြင့် တက်ရောက်မှု မမှတ်တမ်းတင်နိုင်ပါ။',
  'This QR is invalid or has been replaced.':
    'QR မမှန်ပါ သို့မဟုတ် အသစ်ပြန်ထုတ်ထားပါသည်။',
  'You are offline. Reconnect before scanning.':
    'အင်တာနက် မရှိပါ။ စကင်မဖတ်မီ ပြန်ချိတ်ပါ။',
  'You are offline. Reconnect, then retry this scan.':
    'အင်တာနက် မရှိပါ။ ပြန်ချိတ်ပြီး ဤ scan ကို ပြန်စစ်ပါ။',
  'You are offline. No new check-in can be confirmed.':
    'အင်တာနက် မရှိပါ။ တက်ရောက်မှု အသစ်ကို အတည်မပြုနိုင်ပါ။',
  'Retry same scan': 'ဤ scan ကို ပြန်စစ်မည်',
  'A decoded QR becomes a check-in only after the server confirms it.':
    'Server က အတည်ပြုပြီးမှ တက်ရောက်မှုအဖြစ် မှတ်တမ်းတင်ပါသည်။',
  'Ready to scan': 'စကင်ဖတ်ရန် အဆင်သင့်',
  'Saved result recovered. This retry did not charge again.':
    'သိမ်းပြီးသား ရလဒ်ကို ပြန်ရပါပြီ။ အကြိမ်ရေ ထပ်မလျှော့ပါ။',
  'Original check-in shown. No extra visit was charged.':
    'မူလတက်ရောက်ချိန်ကို ပြထားပါသည်။ အကြိမ်ရေ ထပ်မလျှော့ပါ။',
  'Visits remaining': 'လက်ကျန် တက်ရောက်ခွင့်',
  'Check-in cancelled': 'တက်ရောက်မှု ပယ်ဖျက်ထားသည်',
  'Already checked in': 'တက်ရောက်မှု မှတ်တမ်းတင်ပြီးသား',
  'Check-in confirmed': 'တက်ရောက်မှု အတည်ပြုပြီး',
  'Confirming check-in…': 'တက်ရောက်မှု အတည်ပြုနေသည်…',
  'Images are decoded on this device and are not uploaded.':
    'QR ပုံကို ဤစက်တွင်သာ ဖတ်ပြီး server သို့ မတင်ပါ။',
  'Reading QR…': 'QR ဖတ်နေသည်…',
  'QR image': 'QR ပုံ',
  'Or scan a QR image': 'သို့မဟုတ် QR ပုံကို ဖတ်မည်',
  'Start camera': 'ကင်မရာ ဖွင့်မည်',
  'Stop camera': 'ကင်မရာ ပိတ်မည်',
  'Waiting for camera permission…': 'ကင်မရာ ခွင့်ပြုချက်ကို စောင့်နေသည်…',
  'Camera is off': 'ကင်မရာ ပိတ်ထားသည်',
  'Camera preview': 'ကင်မရာ မြင်ကွင်း',
  'Refresh sessions': 'တွေ့ဆုံပွဲများ ပြန်ယူမည်',
  'Select a session': 'တွေ့ဆုံပွဲ ရွေးပါ',
  'Loading sessions…': 'တွေ့ဆုံပွဲများ ရယူနေသည်…',
  Session: 'တွေ့ဆုံပွဲ',
  'Find a session': 'တွေ့ဆုံပွဲ ရှာရန်',
  'Select a meetup, then scan a member QR to record attendance.':
    'တွေ့ဆုံပွဲ ရွေးပြီး Member QR ကို ဖတ်၍ တက်ရောက်မှု မှတ်တမ်းတင်ပါ။',
  'The request timed out. Check whether your change was saved before trying again.':
    'စောင့်ဆိုင်းချိန် ကျော်လွန်သွားပါပြီ။ ပြန်မလုပ်မီ သင့်ပြောင်းလဲမှု သိမ်းပြီးသားလား အရင်စစ်ပါ။',
  'The request took too long. Please try again.':
    'စောင့်ဆိုင်းချိန် ကျော်လွန်သွားပါပြီ။ ပြန်ကြိုးစားပါ။',
  'This is taking a little longer than expected.':
    'ပုံမှန်ထက် အနည်းငယ် ပိုကြာနေပါသည်။',
  'Replacing QR…': 'QR အသစ်ပြန်ထုတ်နေသည်…',
  'Updating password…': 'Password ပြောင်းနေသည်…',
  'Creating account…': 'Account ဖွင့်နေသည်…',
  'Signing out…': 'ထွက်နေသည်…',
  'Signing in…': 'ဝင်နေသည်…',
  'Saving…': 'သိမ်းနေသည်…',
  'Loading staff…': 'ဝန်ထမ်းများ ရယူနေသည်…',
  'Loading…': 'ရယူနေသည်…',
  'Enter your name, a valid Myanmar phone number and a password of 8–128 characters.':
    'နာမည်၊ မှန်ကန်သည့် မြန်မာဖုန်းနံပါတ်နှင့် စာလုံးရေ ၈ မှ ၁၂၈ အထိ password ထည့်ပါ။',
  'Unable to create your account. Check your details. If you already have an account, use the member app or contact MOE.':
    'Account ဖွင့်၍ မရပါ။ အချက်အလက်များ ပြန်စစ်ပါ။ Account ရှိပြီးသားဆိုပါက Member app ကို သုံးပါ သို့မဟုတ် MOE ကို ဆက်သွယ်ပါ။',
  'Members can create an account here or use the MOE member app.':
    'Member များ ဤနေရာတွင် account ဖွင့်နိုင်ပြီး MOE member app ကိုလည်း သုံးနိုင်ပါသည်။',
  'Use the MOE member app to view your QR and membership. Admin will assign your plan separately.':
    'QR နှင့် membership ကြည့်ရန် MOE member app ကို အသုံးပြုပါ။ Admin က သင့် Plan ကို သီးခြားသတ်မှတ်ပေးပါမည်။',
  'Your member account has been created. Use the member app to view your QR and membership.':
    'Member account ဖွင့်ပြီးပါပြီ။ QR နှင့် membership ကြည့်ရန် Member app ကို အသုံးပြုပါ။',
  'Member account ready': 'Member account အဆင်သင့်ဖြစ်ပါပြီ',
  'Creating an account does not assign a membership. Admin will assign your plan separately.':
    'Account ဖွင့်ရုံဖြင့် membership မရသေးပါ။ Admin က သင့် Plan ကို သီးခြားသတ်မှတ်ပေးပါမည်။',
  'Enter your full name.': 'သင့်အမည်အပြည့်အစုံကို ထည့်ပါ။',
  'Use 8–128 characters.': 'စာလုံးရေ ၈ မှ ၁၂၈ အထိ သုံးပါ။',
  'Confirm password': 'Password အတည်ပြုရန်',
  'Join with your name, Myanmar phone number and password.':
    'နာမည်၊ မြန်မာဖုန်းနံပါတ်နှင့် password ဖြင့် account ဖွင့်ပါ။',
  'Create member account': 'Member account ဖွင့်မည်',
  Continue: 'ရှေ့ဆက်မည်',
  'The page you requested does not exist.':
    'သင်တောင်းဆိုသည့် စာမျက်နှာ မရှိပါ။',
  'Page not found': 'စာမျက်နှာ မတွေ့ပါ',
  'Sign in with another account': 'အခြား account ဖြင့် ဝင်မည်',
  'Open member app': 'Member app ဖွင့်မည်',
  'Members sign in and sign up through the MOE member app.':
    'Member များသည် MOE member app တွင် Login နှင့် Sign up လုပ်နိုင်ပါသည်။',
  'Sign in or sign up through the MOE mobile app or member website provided by your team.':
    'MOE mobile app သို့မဟုတ် သင့်အဖွဲ့မှ ပေးထားသော Member website တွင် Login သို့မဟုတ် Sign up လုပ်ပါ။',
  'This console is for administrators and staff. Your account is a member account.':
    'ဤ console သည် Admin နှင့် Staff အတွက် ဖြစ်ပါသည်။ သင့် account သည် Member account ဖြစ်ပါသည်။',
  'Use the member app': 'Member app ကို အသုံးပြုပါ',
  'The previous QR will stop working. Memberships, visits and login sessions remain unchanged.':
    'QR အဟောင်းကို အသုံးပြု၍ မရတော့ပါ။ အသင်းဝင်မှု၊ လက်ကျန်အကြိမ်ရေနှင့် login session များ မပြောင်းလဲပါ။',
  'Showing this QR does not confirm attendance. Staff will check your eligibility when scanning is available.':
    'ဤ QR ပြထားရုံဖြင့် တက်ရောက်မှု မမှတ်တမ်းတင်ပါ။ စကင်ဖတ်ခြင်း ရရှိချိန်တွင် ဝန်ထမ်းက သင့်ဝင်ခွင့်ကို စစ်ဆေးပါမည်။',
  'If Admin replaces your QR, refresh this page. Your previous QR will no longer work.':
    'Admin က QR အသစ်ပြန်ထုတ်ပါက ဤစာမျက်နှာကို ပြန်ဖွင့်ပါ။ QR အဟောင်းကို အသုံးပြု၍ မရတော့ပါ။',
  'Available even without an assigned membership.':
    'အသင်းဝင်မှု မသတ်မှတ်ရသေးလည်း QR ရရှိပါသည်။',
  'Your account has one personal QR across all plans.':
    'အစီအစဉ်အားလုံးအတွက် ကိုယ်ပိုင် QR တစ်ခုတည်းကို အသုံးပြုပါသည်။',
  'Recent QR changes': 'လတ်တလော QR ပြောင်းလဲမှုများ',
  'QR version': 'QR ဗားရှင်း',
  'Refresh QR': 'QR ပြန်ယူမည်',
  'Regenerate QR': 'QR အသစ်ပြန်ထုတ်မည်',
  'Personal QR': 'ကိုယ်ပိုင် QR',
  'Meetup dates use Myanmar time. QR scanning and attendance recording are coming next.':
    'တွေ့ဆုံမည့်ရက်ကို မြန်မာစံတော်ချိန်ဖြင့် သတ်မှတ်ပါသည်။ QR စကင်ဖတ်ခြင်းနှင့် တက်ရောက်မှုမှတ်တမ်းကို နောက်အဆင့်တွင် ထည့်ပါမည်။',
  'Ask your administrator to assign you to a session.':
    'တွေ့ဆုံပွဲတာဝန်ပေးရန် Admin ကို ဆက်သွယ်ပါ။',
  'Organise meetups and manage staff access.':
    'တွေ့ဆုံပွဲများနှင့် ဝန်ထမ်းဝင်ခွင့်ကို စီမံပါ။',
  'Only sessions currently assigned to you are shown.':
    'သင့်ကို တာဝန်ပေးထားသည့် တွေ့ဆုံပွဲများကိုသာ ပြထားပါသည်။',
  'No current staff access': 'လက်ရှိ ဝန်ထမ်းအဖြစ် ဝင်ခွင့်မရှိ',
  'Load more staff': 'နောက်ထပ် ဝန်ထမ်းများကြည့်ရန်',
  'No enabled staff found': 'အသုံးပြုနိုင်သော ဝန်ထမ်း မတွေ့ပါ',
  'No staff assigned': 'ဝန်ထမ်း မသတ်မှတ်ရသေး',
  'Clear dates': 'ရက်စွဲများ ဖျက်မည်',
  'To date': 'ပြီးဆုံးရက်အထိ',
  'From date': 'စတင်ရက်မှ',
  'No sessions found': 'တွေ့ဆုံပွဲ မတွေ့ပါ',
  'All sessions': 'တွေ့ဆုံပွဲအားလုံး',
  'Session or plan name': 'တွေ့ဆုံပွဲ သို့မဟုတ် အစီအစဉ်အမည်',
  'Search sessions': 'တွေ့ဆုံပွဲ ရှာရန်',
  'Clear staff': 'ဝန်ထမ်းအားလုံး ဖယ်မည်',
  'Save staff': 'ဝန်ထမ်းသတ်မှတ်မှု သိမ်းမည်',
  'Find staff': 'ဝန်ထမ်းရှာရန်',
  'Assigned staff': 'တာဝန်ပေးထားသော ဝန်ထမ်းများ',
  'Manage staff': 'ဝန်ထမ်း သတ်မှတ်မည်',
  'Close session': 'တွေ့ဆုံပွဲ ပိတ်မည်',
  'Open session': 'တွေ့ဆုံပွဲ ဖွင့်မည်',
  Closed: 'ပိတ်ထား',
  Open: 'ဖွင့်ထား',
  'Session state': 'တွေ့ဆုံပွဲ အခြေအနေ',
  'Meetup date': 'တွေ့ဆုံမည့်ရက်',
  'Session name': 'တွေ့ဆုံပွဲအမည်',
  'Create session': 'တွေ့ဆုံပွဲ ဖန်တီးမည်',
  used: 'အသုံးပြုပြီး',
  Plan: 'အစီအစဉ်',
  Visits: 'အကြိမ်ရေ',
  Period: 'ကာလ',
  'Find a plan': 'အစီအစဉ်ရှာရန်',
  'Find an account': 'အကောင့်ရှာရန်',
  'Search memberships': 'အသင်းဝင်မှုရှာရန်',
  'Search plans': 'အစီအစဉ်ရှာရန်',
  'Change history': 'ပြောင်းလဲမှုမှတ်တမ်း',
  'All plans': 'အစီအစဉ်အားလုံး',
  'Save plan': 'အစီအစဉ်သိမ်းမည်',
  Archived: 'သိမ်းဆည်းထား',
  Available: 'အသုံးပြုနိုင်',
  Cancelled: 'ပယ်ဖျက်ပြီး',
  Expired: 'သက်တမ်းကုန်ဆုံး',
  Completed: 'အကြိမ်ရေကုန်ဆုံး',
  Upcoming: 'မစတင်သေး',
  Active: 'အသုံးပြုနိုင်',
  'End date': 'ပြီးဆုံးရက်',
  'Start date': 'စတင်ရက်',
  'Total visits': 'တက်ရောက်ခွင့် စုစုပေါင်း',
  Benefits: 'ခံစားခွင့်များ',
  Description: 'ဖော်ပြချက်',
  'Plan name': 'အစီအစဉ်အမည်',
  'Cancel membership': 'အသင်းဝင်မှု ပယ်ဖျက်မည်',
  'Renew membership': 'အသင်းဝင်မှု သက်တမ်းတိုးမည်',
  'Edit membership': 'အသင်းဝင်မှု ပြင်မည်',
  'Assign membership': 'အသင်းဝင်မှု သတ်မှတ်မည်',
  'Create plan': 'အစီအစဉ်ဖန်တီးမည်',
  Overview: 'ခြုံငုံသုံးသပ်ချက်',
  'Users & staff': 'အသုံးပြုသူနှင့် ဝန်ထမ်းများ',
  Plans: 'အစီအစဉ်များ',
  Memberships: 'အသင်းဝင်မှုများ',
  'Meetup sessions': 'တွေ့ဆုံပွဲများ',
  'QR scanner': 'QR စကင်နာ',
  Attendance: 'တက်ရောက်မှု',
  'Reports & export': 'အစီရင်ခံစာများ',
  'Audit log': 'လုပ်ဆောင်မှုမှတ်တမ်း',
  Settings: 'ဆက်တင်များ',
  'Sign out': 'ထွက်မည်',
  'Sign in': 'အကောင့်ဝင်မည်',
  'Members, administrators and staff can sign in here.':
    'အသင်းဝင်များ၊ စီမံခန့်ခွဲသူများနှင့် ဝန်ထမ်းများ ဤနေရာမှ အကောင့်ဝင်နိုင်ပါသည်။',
  'New to MOE? Create a member account to get started.':
    'MOE တွင် အကောင့်မရှိသေးပါက အသင်းဝင်အကောင့် ဖွင့်နိုင်ပါသည်။',
  'Member sign in': 'အသင်းဝင် အကောင့်ဝင်ရန်',
  'For MOE administrators and staff.':
    'MOE စီမံခန့်ခွဲသူနှင့် ဝန်ထမ်းများအတွက်။',
  'Use the sign-in page for your account.':
    'သင့်အကောင့်အတွက် သက်ဆိုင်ရာ ဝင်ရောက်ရန်စာမျက်နှာကို သုံးပါ။',
  'Unable to sign in. Check your phone number and password, then try again.':
    'အကောင့်ဝင်၍ မရပါ။ ဖုန်းနံပါတ်နှင့် စကားဝှက်ကို စစ်ဆေးပြီး ထပ်စမ်းပါ။',
  'Console sign in': 'စီမံခန့်ခွဲရန် ဝင်မည်',
  'Phone number': 'ဖုန်းနံပါတ်',
  Password: 'စကားဝှက်',
  'Admin console': 'စီမံခန့်ခွဲမှု',
  'Staff console': 'ဝန်ထမ်းလုပ်ငန်းခွင်',
  'Member account': 'အသင်းဝင်အကောင့်',
  'Welcome back': 'ပြန်လည်ကြိုဆိုပါသည်',
  'Create account': 'အကောင့်ဖန်တီးမည်',
  'Manage accounts': 'အကောင့်များ စီမံရန်',
  'All roles': 'အခန်းကဏ္ဍအားလုံး',
  'All statuses': 'အခြေအနေအားလုံး',
  Enabled: 'အသုံးပြုခွင့်ရှိ',
  Disabled: 'အသုံးပြုခွင့်ပိတ်',
  Admin: 'စီမံခန့်ခွဲသူ',
  Staff: 'ဝန်ထမ်း',
  Member: 'အသင်းဝင်',
  Name: 'အမည်',
  Role: 'အခန်းကဏ္ဍ',
  Access: 'အသုံးပြုခွင့်',
  'Password setup': 'စကားဝှက်အခြေအနေ',
  Actions: 'လုပ်ဆောင်ရန်',
  Ready: 'အဆင်သင့်',
  'Change required': 'ပြောင်းရန်လို',
  'Search by name or phone': 'အမည် သို့မဟုတ် ဖုန်းဖြင့် ရှာမည်',
  Search: 'ရှာမည်',
  Clear: 'ရှင်းမည်',
  Refresh: 'ပြန်ဖတ်မည်',
  Previous: 'နောက်သို့',
  Next: 'ရှေ့သို့',
  'No matching accounts': 'ကိုက်ညီသော အကောင့်မရှိပါ',
  'Try a different name or phone number.':
    'အခြားအမည် သို့မဟုတ် ဖုန်းနံပါတ်ဖြင့် ရှာကြည့်ပါ။',
  'Full name': 'အမည်အပြည့်အစုံ',
  'Temporary password': 'ယာယီစကားဝှက်',
  Reason: 'အကြောင်းရင်း',
  Cancel: 'မလုပ်တော့ပါ',
  'Save changes': 'ပြင်ဆင်မှု သိမ်းမည်',
  'Reset password': 'စကားဝှက် ပြန်သတ်မှတ်မည်',
  'Edit access': 'အသုံးပြုခွင့် ပြင်မည်',
  'Account settings': 'အကောင့်ဆက်တင်များ',
  'Change password': 'စကားဝှက်ပြောင်းမည်',
  'Current password': 'လက်ရှိစကားဝှက်',
  'New password': 'စကားဝှက်အသစ်',
  'Confirm new password': 'စကားဝှက်အသစ် အတည်ပြုပါ',
  'Update password': 'စကားဝှက်ပြောင်းမည်',
  'Change your temporary password': 'ယာယီစကားဝှက်ကို ပြောင်းပါ',
  'Total accounts': 'အကောင့်စုစုပေါင်း',
  'Enabled accounts': 'အသုံးပြုခွင့်ရှိသော အကောင့်များ',
  'Staff accounts': 'ဝန်ထမ်းအကောင့်များ',
  'Password changes required': 'စကားဝှက်ပြောင်းရန် လိုအပ်သူများ',
  'Account directory': 'အကောင့်စာရင်း',
  'View all accounts': 'အကောင့်အားလုံး ကြည့်မည်',
  'Quick actions': 'အမြန်လုပ်ဆောင်ရန်',
  'Secure your account': 'အကောင့်လုံခြုံရေး',
  'Member number': 'အသင်းဝင်အမှတ်',
  'Preferred language': 'ဘာသာစကား',
  'Coming next': 'မကြာမီ ဆက်ရေးမည်',
  'Back to overview': 'ခြုံငုံသုံးသပ်ချက်သို့ ပြန်မည်',
  Retry: 'ထပ်စမ်းမည်',
  'Please wait…': 'ခဏစောင့်ပါ…',
  'Checking your session…': 'အကောင့်ဝင်ထားမှု စစ်နေသည်…',
  Profile: 'ကိုယ်ရေးအချက်အလက်',
  Close: 'ပိတ်မည်',
  'Open navigation': 'စာမျက်နှာများ ဖွင့်မည်',
  'Close navigation': 'စာမျက်နှာများ ပိတ်မည်',
  'Show password': 'စကားဝှက်ပြမည်',
  'Hide password': 'စကားဝှက်ဖျောက်မည်',
  Page: 'စာမျက်နှာ',
  'Page identity verification completed':
    'Page မှ လူမှန်ဖြစ်ကြောင်း စစ်ပြီးပါပြီ',
  'Accounts on this page': 'ဤစာမျက်နှာရှိ အကောင့်များ',
  Language: 'ဘာသာစကား',
  'Account information': 'အကောင့်အချက်အလက်',
  'Live account data': 'လက်ရှိအကောင့်အချက်အလက်များ',
  'Account access': 'အကောင့်အသုံးပြုခွင့်',
};
Object.assign(my, {
  Soon: 'မကြာမီ',
  You: 'သင်',
  'Shared workspace': 'စုပေါင်းလုပ်ငန်းခွင်',
  'Account security': 'အကောင့်လုံခြုံရေး',
  'Sign in with your phone number and password.':
    'ဖုန်းနံပါတ်နှင့် စကားဝှက်ဖြင့် အကောင့်ဝင်ပါ။',
  'Manage accounts, roles and access in one place.':
    'အကောင့်များနှင့် အသုံးပြုခွင့်များကို စီမံပါ။',
  'Manage your password and workspace language.':
    'စကားဝှက်နှင့် ဘာသာစကားကို ရွေးချယ်ပါ။',
  'Passwords do not match.': 'စကားဝှက်များ မတူပါ။',
  'Choose a different new password.': 'မတူသော စကားဝှက်အသစ်ကို ရွေးပါ။',
  'Phone number or password is incorrect.':
    'ဖုန်းနံပါတ် သို့မဟုတ် စကားဝှက် မှားနေပါသည်။',
  'Current password is incorrect, or your session expired.':
    'လက်ရှိစကားဝှက် မှားနေခြင်း သို့မဟုတ် ဝင်ထားမှုသက်တမ်း ကုန်နေခြင်း ဖြစ်နိုင်ပါသည်။',
  'Plans & memberships': 'အစီအစဉ်နှင့် အသင်းဝင်မှုများ',
  'Attendance reports': 'တက်ရောက်မှု အစီရင်ခံစာ',
  'Members, staff and administrators':
    'အသင်းဝင်၊ ဝန်ထမ်းနှင့် စီမံခန့်ခွဲသူများ',
  'Keep your workspace up to date': 'လိုအပ်သော ပြင်ဆင်မှုများ လုပ်ဆောင်ပါ',
  'Create accounts and manage access': 'အကောင့်ဖန်တီးပြီး အသုံးပြုခွင့် စီမံပါ',
  'Update your password': 'စကားဝှက်ပြောင်းပါ',
  'Why are you making this change?': 'ပြောင်းလဲမှုအကြောင်းရင်း ထည့်ပါ။',
  'This workspace is being prepared.': 'ဤလုပ်ဆောင်ချက်ကို ပြင်ဆင်နေပါသည်။',
  'Your session has expired. Please sign in again.':
    'ဝင်ထားမှုသက်တမ်း ကုန်ပါပြီ။ ပြန်ဝင်ပါ။',
  'You have signed out.': 'အကောင့်မှ ထွက်ပြီးပါပြီ။',
  'Password updated. Sign in again with your new password.':
    'စကားဝှက်ပြောင်းပြီးပါပြီ။ စကားဝှက်အသစ်ဖြင့် ပြန်ဝင်ပါ။',
  'Set a new password before continuing to your workspace.':
    'ဆက်သုံးရန် စကားဝှက်အသစ်ကို အရင်ပြောင်းပါ။',
  'Updating your password signs you out on every device. Sign in again with the new password.':
    'စကားဝှက်ပြောင်းလျှင် စက်အားလုံးမှ ထွက်သွားပါမည်။ စကားဝှက်အသစ်ဖြင့် ပြန်ဝင်ပါ။',
  'The account owner must change this password at first sign-in.':
    'ပထမဆုံး ဝင်ချိန်တွင် ယာယီစကားဝှက်ကို ပြောင်းရပါမည်။',
});
export function useText() {
  const language = useContext(LanguageContext);
  return (text: string) => (language === 'my' ? my[text] || text : text);
}
