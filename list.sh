#!/bin/sh

cut -d\  -f1 revstore_log | uniq | (tac 2>/dev/null || tail -f)
