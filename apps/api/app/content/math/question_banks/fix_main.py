#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os

script_path = r'D:\web app\4-craft.com\apps\api\app\content\math\question_banks\generate_qb.py'

new_main = '''

# ══════════════════════════════════════════════════════════════
# MAIN (Grade 1-2 partial)
# ══════════════════════════════════════════════════════════════
TOPICS = {
    1: [
        ('g1_counting_20','การนับเลขถึง 20','g1_counting_20'),
        ('g1_add_one_digit','การบวกเลขหลักเดียว','g1_add_one_digit'),
        ('g1_subtract_one_digit','การลบเลขหลักเดียว','g1_subtract_one_digit'),
        ('g1_compare_numbers','การเปรียบเทียบจำนวน','g1_compare_numbers'),
        ('g1_number_order','ลำดับจำนวน','g1_number_order'),
        ('g1_shapes_2d_basic','รูปร่างพื้นฐาน','g1_shapes_2d_basic'),
        ('g1_position_direction','ตำแหน่งและทิศทาง','g1_position_direction'),
    ],
    2: [
        ('g2_add_two_digit','การบวกเลขสองหลัก','g2_add_two_digit'),
        ('g2_subtract_two_digit','การลบเลขสองหลัก','g2_subtract_two_digit'),
        ('g2_multiplication_intro','การคูณเบื้องต้น','g2_multiplication_intro'),
        ('g2_times_table_2_5_10','ตารางคูณ 2, 5, 10','g2_times_table_2_5_10'),
        ('g2_money_change','เงินและการทอนเงิน','g2_money_change'),
    ],
}

GEN_MAP = {
    'g1_counting_20': gen_g1_counting_20,
    'g1_add_one_digit': gen_g1_add_one_digit,
    'g1_subtract_one_digit': gen_g1_subtract_one_digit,
    'g1_compare_numbers': gen_g1_compare_numbers,
    'g1_number_order': gen_g1_number_order,
    'g1_shapes_2d_basic': gen_g1_shapes_2d_basic,
    'g1_position_direction': gen_g1_position_direction,
    'g2_add_two_digit': gen_g2_add_two_digit,
    'g2_subtract_two_digit': gen_g2_subtract_two_digit,
    'g2_multiplication_intro': gen_g2_multiplication_intro,
    'g2_times_table_2_5_10': gen_g2_times_table_2_5_10,
    'g2_money_change': gen_g2_money_change,
}

if __name__ == '__main__':
    total = 0
    for g, topics in sorted(TOPICS.items()):
        for tc, name, skill in topics:
            print(f'Generating grade {g} {tc}...')
            gen_fn = GEN_MAP.get(tc)
            if gen_fn:
                qs = gen_fn(tc, skill)
                save_jsonl(tc, qs)
                total += len(qs)
            else:
                print(f'  WARNING: no generator for {tc}')
    print(f'Grade 1-2 partial: {total} questions written.')
    print('Done.')
'''

with open(script_path, 'r', encoding='utf-8') as f:
    src = f.read()

# Remove old main loop (find last 'if __name__' block)
parts = src.split('if __name__ == ')
if len(parts) > 1:
    src = parts[0]
    src += new_main

with open(script_path, 'w', encoding='utf-8') as f:
    f.write(src)

print('Fixed. New length:', len(src), 'chars')
