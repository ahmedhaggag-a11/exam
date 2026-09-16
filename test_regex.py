import re

text = '''
1- أ
2- ب
3- ج
4- د
'''

matches = re.findall(r'(?:س|Q|)?\s*(\d{1,3})\s*[-:=>\.]?\s*([أبجدABCD])(?:\s|$)', text, re.IGNORECASE)
print(matches)
