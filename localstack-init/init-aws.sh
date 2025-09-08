#!/bin/bash
echo "---Creating SQS queue---"
awslocal sqs create-queue \
  --queue-name live-chat-events.fifo \
  --attributes FifoQueue=true,ContentBasedDeduplication=true
echo "---SQS queue created---"