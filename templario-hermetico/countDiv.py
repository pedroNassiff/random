# Range of number starting A to B. K is an integer that can be evenly divided in to a number contained in A and B. The solution is to return the number of times, or the count that k can evenly go into a number
# a = 6
# b = 11
# set(range(a, b +1))
# k = 2 y este se puede dividir en 6, 8, 10. Por lo tanto, el resultado es 3.


#########SOLUTION#########
def solution(A, B, K):
   if A % K == 0:
      return (B - A) // K + 1
   if A % K > 0:
      return (B - (A - A % K)) // K