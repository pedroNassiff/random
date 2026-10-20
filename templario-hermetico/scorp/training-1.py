# arrays
arr = [1,2,3]
# print(arr)

arr.append(4)
arr.append(5)
# print(arr)

arr.pop()
# print(arr)

arr.insert(1,7)
# print(arr)

# Initialize arr of size n with default value of 1
n = 5
arr = [1] * n
# print(arr)
# print(len(arr))

# sublists (aka slicing)
arr = [1,2,3,4]
# print(arr[0:4])

# unpacking
a,b,c = [1,2,3]
# print(a,b,c)

# loop throught arrays
nums = [1,2,3]

# using index
# for i in range(len(nums)):
#     print(nums[i])

# # without index
# for num in nums:
#     print(num)

# # with index and value
# for i,n in enumerate(nums):
#     print(i,n)


# loop through multiple arrays simultaneousl with unpackaing

# nums1 = [1,3,5]
# nums2 = [2,4,6]
# for n1,n2 in zip(nums1,nums2):
#     print(n1,n2)

# reverse
# nums = [1,2,3]
# nums.reverse()
# print(nums)

# # sorting
# arr = [3,1,2]
# arr.sort()
# print(arr)

# arr = ["banana", "apple", "cherry"]
# # arr.sort()
# # print(arr)  # Output: ['apple', 'banana', 'cherry']

# # custom sort (by lenght of string
# arr.sort(key=lambda x: len(x))
# print(arr)  # Output: ['apple', 'banana', 'cherry']

# list comprehension
# arr = [i+i for i in range(5)]
# print(arr)  # Output: [0, 1, 2, 3, 4]

# 2-d lists
# arr = [[0] * 4 for i in range(4)]
# print(arr)  # Output: [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]]

# # strings
# s = "abc"
# print(s[0:2])  # Output: "ab"

# # create new string 
# s += "dfgh"
# print(s)  # Output: "abcdfgh"

# print(int("123") + int("456"))  # Output: 579
# print(str(123) + str(456))  # Output: "123456"

# conbine list of strings (with empty string delimitor)
# strings = ["ab", "cd", "ef"]
# print("".join(strings))

# Queues (double ended queue)
# from collections import deque

# queue = deque()
# queue.append(1)
# queue.append(2)
# print(queue)  # Output: deque([1, 2])

# queue.popleft()
# print(queue)

# queue.appendleft(1)
# print(queue)

# queue.pop()
# print(queue)  # Output: deque([1])

# hasset
# mySet = set()
# mySet.add(1)
# mySet.add(2)

# print(mySet)  # Output: {1, 2}
# print(len(mySet))  # Output: 2
# print(4 in mySet)  # Output: True

# set compresion
# mySet = {i for i in range(5)}
# print(mySet)  # Output: {0, 1, 2, 3

# HashMap (aka dict)
# myMap = {}
# myMap["Oscar"] = 76
# myMap["Emi"] = 4
# print(myMap)  # Output: {'Oscar': 76, 'Emi': 4}
# print(len(myMap))  # Output: 2

# print("Emi" in myMap)  # Output: True
# myMap["Emi"] = 5 
# print(myMap)  # Output: {'Oscar': 76, 'Emi': 5}

# dict compresion

# myMap = {i: 2*i for i in range(5)}
# print(myMap)  # Output: {0: 0, 1: 2

# looping throught maps
# myMap = { "alice": 85, "bob": 90, "charlie": 78 }
# for key in myMap:
#     print(key, myMap[key])  # Output: alice 85, bob 90, charlie 78

# for val in myMap.values():
#     print(val)  # Output: 85, 90, 78

# for key, val in myMap.items():
#     print(key, val)  # Output: alice 85, bob 90, charlie 78

# tuples are like arrays but inmutable
# tup = (1,2,3)
# print(tup)
# print(tup[0])
# print(tup[-1])

# heaps
# import heapq

# minHeap = []
# heapq.heappush(minHeap, 3)
# heapq.heappush(minHeap, 2)
# heapq.heappush(minHeap, 4)

# # min is always at index 0
# print(minHeap[0])

# while len(minHeap):
#     print(heapq.heappop(minHeap))

# neted funcions have acces to outer variables
# def outer(a,b):
#     c = "c"

#     def inner():
#         return a + b + c
#     return inner()

# print(outer("a", "b"))


#  can modify objects but not reassign unless using nonlocal keyword

# def double(arr, val):
#     def helper():
#         # modifyng array works
#         for i,n in enumerate(arr):
#             arr[i] *= 2

#         # will only modify val in the helper scope
#         # val *= 2

#         # this will modify val outside helper scope
#         nonlocal val

#         val *= 2
#     helper()
#     print(arr,val)

# nums = [1,2]
# val = 3

# Class
# class MyClass:
#     # constructor
#     def __init__(self, nums):
#         # create member variables
#         self.nums = nums
#         self.size = len(nums)

#     # self key word required as param
#     def getLenght(self):
#         return self.size

#     def getDoubleLenght(self):
#         return 2 * self.getLenght()

# hash map
# def count_repeat(paymets_id):
#     count = {}
#     for payment in paymets_id:
#         count[payment] = count.get(payment, 0) +1
#     repeated = {}
#     for payment, repeat in count.items():
#         if repeat > 1:
#             repeated[payment] = repeat
#     return repeated

# print(count_repeat(["p1", "p7", "p3", "p7", "p1"]))

# enumerate and list
# drinks = ["fernet", "vino", "cerveza"]
# ennumerate_drinks = enumerate(drinks)
# list_enumerate_Drinks = list(ennumerate_drinks)
# print(type(list_enumerate_Drinks))
# print(list_enumerate_Drinks)


#  Dada una lista de montos de regalos, ¿hay dos que sumen exactamente 100?

# def findgift(gifts):
#     for i in range(len(gifts)):
#         for j in range(i + 1, len(gifts)):
#             if gifts[i] + gifts[j] == 100:
#                 return True
#     return False

# print(findgift([30,20,70]))
            

# Un usuario tiene una gift card de 50 y una lista de precios de productos: [15, 40, 25, 10, 35]. 
# ¿Puede gastar exactamente los 50 comprando dos productos distintos? Devolvé True o False.

# 1. FORMA
#    Entra: gift card de 50 y los precios de los productos
#    Sale: ... True si sumando 2 productos da 50 exactamente
#    Ejemplo: [15, 40, 25, 10, 35] → ... (¿qué par?) [35,15], [40,10]

# 2. BORDES (preguntas que harías al entrevistador)
#    - puede sobrar monto del gift o cerrar en 50 y comsumir los 50?
#    - descartamos los que sumamos y no dan 50 ?
#   - se puede comprar 2 veces el mismo producto? 

# 3. FUERZA BRUTA
#    Candidatos: todos los pares
#    Chequeo: 2 loops anidados
#    Costo: O(n2)

# 4. EL LOOP DE ADENTRO, EN PALABRAS
#    "Para este producto, recorro los demás buscando que la suma de los 2 de 50 exactamente"
#    → Pregunta: "¿si la suma de 2 productos es igual a 50 es True?"


# 4. EL LOOP DE ADENTRO, EN PALABRAS - claude
#    "Para este producto de precio p, recorro los demás buscando
#     uno que cueste exactamente 50 - p"
#    → Pregunta: "¿Ya pasé por un producto que cueste 50 - p?"

# 5. ESTRUCTURA QUE LA RESPONDE EN O(1)
#    ... porque ...
#    ¿Necesito saber DÓNDE está, o solo SI está? → ...
    #  ESTO NO ME CIERRA, seria range? e ir sumando i +1 en el loop de j para mover el indice y luego sumar a

# 6. PSEUDOCÓDIGO
#    para i en el rango de precios
#    para j en el rango de precios
#.   es i + j menos o igual a 50? TRUE sino False

# 7. CÓDIGO + OUTPUT de estos casos:

def giftcard(productlist):
    for i in range(len(productlist)):
        for j in range(i + 1, len(productlist)):
            if productlist[i] + productlist[j] <= 50:
                return True
    return False

print(giftcard([60,70]))

#    [15, 40, 25, 10, 35] → True
#    [25]                 → False  (un solo producto)
#    [25, 25]             → True   (dos productos de 25)
#    []                   → False
#    [60, 70]             → False

# 8. COMPLEJIDAD
#    Tiempo: O(...)  Espacio: O(...)