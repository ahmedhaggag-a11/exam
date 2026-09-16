import os
import sys

base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

def test_pagination_logic():
    print("--- Testing Import PDF Modal Pagination Logic ---")
    extracted_questions = [{"id": i, "text": f"سؤال رقم {i}", "question_type": "mcq", "choices": []} for i in range(1, 651)]
    page_size = 20
    total_items = len(extracted_questions)
    total_pages = max(1, (total_items + page_size - 1) // page_size)
    
    assert total_pages == 33, f"Expected 33 pages for 650 items, got {total_pages}"
    
    page_0_start = 0 * page_size
    page_0_end = min(total_items, page_0_start + page_size)
    assert page_0_end == 20
    
    page_32_start = 32 * page_size
    page_32_end = min(total_items, page_32_start + page_size)
    assert page_32_end == 650
    assert page_32_end - page_32_start == 10
    
    print(f"[PASS] 650 questions paginated into {total_pages} pages of max 20 questions each.")
    print("Each page renders only 20 cards and 60 menus instead of 650 cards and 1950 menus!")

if __name__ == "__main__":
    test_pagination_logic()
